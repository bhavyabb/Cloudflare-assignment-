import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env } from './types';
import { buildSlackBlocks } from './slack-formatter';

type AggregateData = {
  bySource: any[];
  bySentiment: any[];
  byUrgency: any[];
  byProduct: any[];
  topIssues: any[];
  total: number;
};

export class FeedbackPipelineWorkflow extends WorkflowEntrypoint<Env, {}> {
  async run(event: WorkflowEvent<{}>, step: WorkflowStep) {

    // STEP 1: Count total and unprocessed feedback
    const counts = await step.do('count-feedback', async () => {
      const total = await this.env.DB.prepare('SELECT COUNT(*) as c FROM feedback').first<{ c: number }>();
      const unprocessed = await this.env.DB.prepare(
        'SELECT COUNT(*) as c FROM feedback WHERE processed_at IS NULL'
      ).first<{ c: number }>();
      return { total: total?.c || 0, unprocessed: unprocessed?.c || 0 };
    });

    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(counts.unprocessed / BATCH_SIZE);

    // STEP 2: Sentiment analysis in batches
    for (let i = 0; i < totalBatches; i++) {
      await step.do(`sentiment-batch-${i}`, async () => {
        const rows = await this.env.DB.prepare(
          'SELECT id, content FROM feedback WHERE sentiment IS NULL LIMIT ?'
        ).bind(BATCH_SIZE).all();

        for (const row of rows.results) {
          const r = row as any;
          try {
            const result: any = await this.env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
              text: r.content
            });
            const label = Array.isArray(result) ? result[0]?.label : result?.label || 'unknown';
            const score = Array.isArray(result) ? result[0]?.score : result?.score || 0.5;
            await this.env.DB.prepare(
              'UPDATE feedback SET sentiment = ?, sentiment_score = ? WHERE id = ?'
            ).bind(label.toLowerCase(), score, r.id).run();
          } catch {
            await this.env.DB.prepare(
              'UPDATE feedback SET sentiment = ?, sentiment_score = ? WHERE id = ?'
            ).bind('unknown', 0.5, r.id).run();
          }
        }
        return { processed: rows.results.length };
      });
    }

    // STEP 3: Urgency classification in batches
    for (let i = 0; i < totalBatches; i++) {
      await step.do(`urgency-batch-${i}`, async () => {
        const rows = await this.env.DB.prepare(
          'SELECT id, content, urgency FROM feedback WHERE computed_urgency IS NULL LIMIT ?'
        ).bind(BATCH_SIZE).all();

        for (const row of rows.results) {
          const r = row as any;
          let urgency = r.urgency;
          if (!urgency) {
            try {
              const res: any = await (this.env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [{
                  role: 'user',
                  content: `Classify this feedback urgency. Production outages=critical, bugs affecting users=high, feature requests=medium, nice-to-haves=low. Reply with ONE word only: critical, high, medium, or low.\n\nFeedback: ${r.content.substring(0, 300)}`
                }],
                max_tokens: 10
              });
              const text = res?.response || '';
              const match = text.toLowerCase().match(/\b(critical|high|medium|low)\b/);
              urgency = match ? match[1] : 'medium';
            } catch {
              urgency = 'medium';
            }
          }
          await this.env.DB.prepare(
            'UPDATE feedback SET computed_urgency = ? WHERE id = ?'
          ).bind(urgency, r.id).run();
        }
        return { processed: rows.results.length };
      });
    }

    // STEP 4: Product area classification in batches
    for (let i = 0; i < totalBatches; i++) {
      await step.do(`product-area-batch-${i}`, async () => {
        const rows = await this.env.DB.prepare(
          'SELECT id, content FROM feedback WHERE product_area IS NULL LIMIT ?'
        ).bind(BATCH_SIZE).all();

        const areas = ['D1-Database', 'KV-Storage', 'R2-Storage', 'Workers-Runtime', 'Workers-AI', 'Wrangler-CLI', 'Dashboard-UI', 'Documentation', 'Pricing', 'Workflows', 'Durable-Objects', 'Networking', 'Security', 'Other'];

        for (const row of rows.results) {
          const r = row as any;
          try {
            const res: any = await (this.env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [{
                role: 'user',
                content: `Classify this Cloudflare feedback into one area. Options: D1-Database, KV-Storage, R2-Storage, Workers-Runtime, Workers-AI, Wrangler-CLI, Dashboard-UI, Documentation, Pricing, Workflows, Durable-Objects, Networking, Other. Reply with ONLY the area name.\n\n${r.content.substring(0, 300)}`
              }],
              max_tokens: 15
            });
            const text = res?.response || 'Other';
            const found = areas.find(a => text.toLowerCase().includes(a.toLowerCase().split('-')[0].toLowerCase()));
            await this.env.DB.prepare(
              'UPDATE feedback SET product_area = ? WHERE id = ?'
            ).bind(found || 'Other', r.id).run();
          } catch {
            await this.env.DB.prepare(
              'UPDATE feedback SET product_area = ? WHERE id = ?'
            ).bind('Other', r.id).run();
          }
        }
        return { processed: rows.results.length };
      });
    }

    // STEP 5: Export feedback to R2
    await step.do('export-to-r2', async () => {
      const rows = await this.env.DB.prepare(
        'SELECT * FROM feedback WHERE processed_at IS NULL'
      ).all();
      let exported = 0;
      for (const row of rows.results) {
        const r = row as any;
        const content = `Source: ${r.source}\nAuthor: ${r.author}\nUrgency: ${r.computed_urgency || r.urgency || 'unknown'}\nSentiment: ${r.sentiment || 'unknown'}\nProduct Area: ${r.product_area || 'unknown'}\nDate: ${r.created_at}\n---\n${r.content}`;
        await this.env.R2.put(`feedback/${r.source}/${r.id}.txt`, content);
        exported++;
      }
      return { exported };
    });

    // STEP 6: Build aggregate statistics
    const aggregates: AggregateData = await step.do('build-aggregates', async () => {
      const bySource = await this.env.DB.prepare(
        'SELECT source, COUNT(*) as cnt FROM feedback GROUP BY source'
      ).all();
      const bySentiment = await this.env.DB.prepare(
        'SELECT sentiment, COUNT(*) as cnt FROM feedback GROUP BY sentiment'
      ).all();
      const byUrgency = await this.env.DB.prepare(
        "SELECT computed_urgency, COUNT(*) as cnt FROM feedback GROUP BY computed_urgency ORDER BY CASE computed_urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END"
      ).all();
      const byProduct = await this.env.DB.prepare(
        'SELECT product_area, computed_urgency, COUNT(*) as cnt FROM feedback GROUP BY product_area, computed_urgency ORDER BY cnt DESC'
      ).all();
      const topIssues = await this.env.DB.prepare(
        "SELECT product_area, computed_urgency, content, id FROM feedback WHERE computed_urgency IN ('critical','high') ORDER BY created_at DESC LIMIT 30"
      ).all();

      return {
        bySource: bySource.results as any[],
        bySentiment: bySentiment.results as any[],
        byUrgency: byUrgency.results as any[],
        byProduct: byProduct.results as any[],
        topIssues: topIssues.results as any[],
        total: counts.total
      };
    }) as any;

    // STEP 7: Generate priority matrix with AI
    const matrix: any[] = await step.do('generate-priority-matrix', async () => {
      const prompt = `You are a product manager analyzing customer feedback for Cloudflare. Here is aggregated data:

Product areas and urgency counts:
${JSON.stringify(aggregates.byProduct, null, 2)}

Top critical/high issues:
${aggregates.topIssues.map((r: any) => `- [${r.product_area}/${r.computed_urgency}] ${r.content.substring(0, 100)}`).join('\n')}

Generate a priority matrix as a JSON array. Each item: {"product_area": string, "priority": "critical"|"high"|"medium"|"low", "issue_count": number, "top_issues": [string, string], "recommendation": string}.
Order by priority (critical first). Include all product areas with issues.
Respond with ONLY valid JSON array, no other text.`;

      try {
        const res: any = await (this.env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800
        });
        const text = res?.response || '[]';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        const productMap = new Map<string, any>();
        for (const r of aggregates.byProduct) {
          if (!productMap.has(r.product_area)) {
            productMap.set(r.product_area, { product_area: r.product_area, priority: r.computed_urgency, issue_count: 0, top_issues: [] });
          }
          productMap.get(r.product_area).issue_count += r.cnt;
        }
        return Array.from(productMap.values());
      }
    }) as any;

    // STEP 8: Generate action items
    const actionItems: string[] = await step.do('generate-action-items', async () => {
      try {
        const res: any = await (this.env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{
            role: 'user',
            content: `Based on this feedback priority matrix, generate 5-7 specific action items for the product team. Each should be actionable and specific. Matrix: ${JSON.stringify(matrix).substring(0, 1000)}. Respond with a JSON array of strings.`
          }],
          max_tokens: 400
        });
        const text = res?.response || '[]';
        const match = text.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : defaultActions();
      } catch {
        return defaultActions();
      }
    }) as any;

    // STEP 9: Store results in KV
    await step.do('store-results', async () => {
      const summary: any = {
        generated_at: new Date().toISOString(),
        total_feedback: counts.total,
        by_source: Object.fromEntries(aggregates.bySource.map((r: any) => [r.source, r.cnt])),
        by_sentiment: Object.fromEntries(aggregates.bySentiment.map((r: any) => [r.sentiment || 'unknown', r.cnt])),
        by_urgency: Object.fromEntries(aggregates.byUrgency.map((r: any) => [r.computed_urgency || 'unknown', r.cnt])),
        priority_matrix: matrix,
        action_items: actionItems
      };

      await this.env.KV.put('priority-matrix', JSON.stringify(matrix), { expirationTtl: 86400 });
      await this.env.KV.put('daily-summary', JSON.stringify(summary), { expirationTtl: 86400 });
      await this.env.KV.put('last-pipeline-run', new Date().toISOString());

      const slackBlocks = buildSlackBlocks(summary);
      await this.env.KV.put('slack-payload', JSON.stringify(slackBlocks), { expirationTtl: 86400 });

      return { stored: true };
    });

    // STEP 10: Mark all rows as processed
    await step.do('mark-processed', async () => {
      await this.env.DB.prepare(
        "UPDATE feedback SET processed_at = datetime('now') WHERE processed_at IS NULL"
      ).run();
      return { done: true };
    });

    return { success: true, total: counts.total, generated_at: new Date().toISOString() };
  }
}

function defaultActions(): string[] {
  return [
    'Review critical D1 database stability issues reported by enterprise customers',
    'Improve Workers error messages to include actionable context and line numbers',
    'Update documentation gaps around bindings, testing, and migration guides',
    'Address KV read-after-write consistency concerns within single requests',
    'Fix wrangler CLI issues: deploy hangs, tail disconnects, type generation'
  ];
}
