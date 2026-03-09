import type { PriorityMatrixItem, DailySummary } from './types';

const PRODUCT_AREAS = [
  'D1-Database', 'KV-Storage', 'R2-Storage', 'Workers-Runtime', 'Workers-AI',
  'Wrangler-CLI', 'Dashboard-UI', 'Documentation', 'Pricing', 'Workflows',
  'Durable-Objects', 'Networking', 'Security', 'Other'
];

export async function analyzeSentiment(ai: Ai, text: string): Promise<{ label: string; score: number }> {
  try {
    const result: any = await ai.run('@cf/huggingface/distilbert-sst-2-int8', { text });
    const label = Array.isArray(result) ? result[0]?.label : result?.label || 'unknown';
    const score = Array.isArray(result) ? result[0]?.score : result?.score || 0.5;
    return { label: label.toLowerCase(), score };
  } catch {
    return { label: 'unknown', score: 0.5 };
  }
}

export async function classifyUrgency(ai: Ai, text: string, existingUrgency: string | null): Promise<string> {
  if (existingUrgency) return existingUrgency;

  try {
    const res: any = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{
        role: 'user',
        content: `Classify this feedback urgency. Production outages=critical, bugs affecting users=high, feature requests=medium, nice-to-haves=low. Reply with ONE word only: critical, high, medium, or low.\n\nFeedback: ${text.substring(0, 300)}`
      }],
      max_tokens: 10
    });
    const response = (res as any)?.response || '';
    const match = response.toLowerCase().match(/\b(critical|high|medium|low)\b/);
    return match ? match[1] : 'medium';
  } catch {
    return 'medium';
  }
}

export async function classifyProductArea(ai: Ai, text: string): Promise<string> {
  try {
    const res: any = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{
        role: 'user',
        content: `Classify this Cloudflare feedback into one area. Options: D1-Database, KV-Storage, R2-Storage, Workers-Runtime, Workers-AI, Wrangler-CLI, Dashboard-UI, Documentation, Pricing, Workflows, Durable-Objects, Networking, Other. Reply with ONLY the area name.\n\n${text.substring(0, 300)}`
      }],
      max_tokens: 15
    });
    const response = (res as any)?.response || 'Other';
    const found = PRODUCT_AREAS.find(a => response.toLowerCase().includes(a.toLowerCase().split('-')[0].toLowerCase()));
    return found || 'Other';
  } catch {
    return 'Other';
  }
}

export async function generatePriorityMatrix(
  ai: Ai,
  byProduct: any[],
  topIssues: any[]
): Promise<PriorityMatrixItem[]> {
  const prompt = `You are a product manager analyzing customer feedback for Cloudflare. Here is aggregated data:

Product areas and urgency counts:
${JSON.stringify(byProduct, null, 2)}

Top critical/high issues:
${topIssues.map((r: any) => `- [${r.product_area}/${r.computed_urgency}] ${r.content.substring(0, 100)}`).join('\n')}

Generate a priority matrix as a JSON array. Each item: {"product_area": string, "priority": "critical"|"high"|"medium"|"low", "issue_count": number, "top_issues": [string, string], "recommendation": string}.
Order by priority (critical first). Include all product areas with issues.
Respond with ONLY valid JSON array, no other text.`;

  try {
    const res: any = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800
    });
    const text = res?.response || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    const productMap = new Map<string, any>();
    for (const r of byProduct) {
      if (!productMap.has(r.product_area)) {
        productMap.set(r.product_area, {
          product_area: r.product_area,
          priority: r.computed_urgency || 'medium',
          issue_count: 0,
          top_issues: [],
          sentiment_avg: 0,
          sample_feedback_ids: []
        });
      }
      productMap.get(r.product_area).issue_count += r.cnt;
    }
    return Array.from(productMap.values());
  }
}

export async function generateActionItems(ai: Ai, matrix: any[]): Promise<string[]> {
  try {
    const res: any = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{
        role: 'user',
        content: `Based on this feedback priority matrix, generate 5-7 specific action items for the product team. Each should be actionable and specific. Matrix: ${JSON.stringify(matrix).substring(0, 1000)}. Respond with a JSON array of strings.`
      }],
      max_tokens: 400
    });
    const text = res?.response || '[]';
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : fallbackActions();
  } catch {
    return fallbackActions();
  }
}

function fallbackActions(): string[] {
  return [
    'Review critical D1 database stability issues reported by enterprise customers',
    'Improve Workers error messages to include actionable context and line numbers',
    'Update documentation gaps around bindings, testing, and migration guides',
    'Address KV read-after-write consistency concerns within single requests',
    'Fix wrangler CLI issues: deploy hangs, tail disconnects, type generation',
    'Clarify Workers AI pricing model — neurons vs tokens confusion',
    'Add visual workflow debugger for Workflows product'
  ];
}
