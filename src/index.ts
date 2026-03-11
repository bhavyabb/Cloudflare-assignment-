import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { SEED_SQL_STATEMENTS } from './seed-data';
import { getDashboardHtml } from './dashboard';

// Re-export the Workflow class so wrangler can find it
export { FeedbackPipelineWorkflow } from './workflow';

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());

// Dashboard
app.get('/', (c) => {
  return c.html(getDashboardHtml());
});

// Seed D1 with mock data
app.post('/api/seed', async (c) => {
  try {
    await c.env.DB.exec('DELETE FROM feedback');

    const statements = SEED_SQL_STATEMENTS;
    const BATCH = 20;
    let inserted = 0;

    for (let i = 0; i < statements.length; i += BATCH) {
      const batch = statements.slice(i, i + BATCH);
      await c.env.DB.batch(
        batch.map((s) => c.env.DB.prepare(s.sql).bind(...s.params))
      );
      inserted += batch.length;
    }

    const total = await c.env.DB
      .prepare('SELECT COUNT(*) as c FROM feedback')
      .first<{ c: number }>();

    return c.json({
      success: true,
      inserted,
      total: total?.c || 0
    });
  } catch (e: any) {
    return c.json({
      success: false,
      error: e.message,
      stack: e.stack || null
    }, 500);
  }
});

// Get feedback with filters
app.get('/api/feedback', async (c) => {
  const source = c.req.query('source');
  const urgency = c.req.query('urgency');
  const sentiment = c.req.query('sentiment');
  const limit = parseInt(c.req.query('limit') || '50');

  let sql = 'SELECT * FROM feedback WHERE 1=1';
  const params: any[] = [];
  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (urgency) { sql += ' AND (computed_urgency = ? OR urgency = ?)'; params.push(urgency, urgency); }
  if (sentiment) { sql += ' AND sentiment = ?'; params.push(sentiment); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ results: result.results, count: result.results.length });
});

// Trigger the full pipeline workflow
app.post('/api/run-pipeline', async (c) => {
  const instance = await c.env.FEEDBACK_PIPELINE.create({ id: `pipeline-${Date.now()}` });
  return c.json({ instanceId: instance.id, status: 'started' });
});

// Check workflow status
app.get('/api/pipeline/:id', async (c) => {
  const id = c.req.param('id');
  const instance = await c.env.FEEDBACK_PIPELINE.get(id);
  const status = await instance.status();
  return c.json(status);
});

// Get priority matrix from KV
app.get('/api/priority-matrix', async (c) => {
  const data = await c.env.KV.get('priority-matrix', 'json');
  return c.json(data || []);
});

// Get daily summary from KV
app.get('/api/daily-summary', async (c) => {
  const data = await c.env.KV.get('daily-summary', 'json');
  return c.json(data || {});
});

// Get Slack-formatted payload from KV
app.get('/api/slack-payload', async (c) => {
  const data = await c.env.KV.get('slack-payload', 'json');
  return c.json(data || { blocks: [] });
});

// Aggregate stats (no AI, just SQL)
app.get('/api/stats', async (c) => {
  const total = await c.env.DB.prepare('SELECT COUNT(*) as c FROM feedback').first();
  const bySource = await c.env.DB.prepare('SELECT source, COUNT(*) as c FROM feedback GROUP BY source').all();
  const bySentiment = await c.env.DB.prepare('SELECT sentiment, COUNT(*) as c FROM feedback WHERE sentiment IS NOT NULL GROUP BY sentiment').all();
  const byUrgency = await c.env.DB.prepare('SELECT computed_urgency, COUNT(*) as c FROM feedback WHERE computed_urgency IS NOT NULL GROUP BY computed_urgency').all();
  const lastRun = await c.env.KV.get('last-pipeline-run');
  return c.json({
    total: (total as any)?.c || 0,
    bySource: bySource.results,
    bySentiment: bySentiment.results,
    byUrgency: byUrgency.results,
    lastPipelineRun: lastRun
  });
});

export default app;
