export function buildSlackBlocks(summary: any) {
  return {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📊 FeedbackPulse Daily Digest' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${new Date().toLocaleDateString()}* | ${summary.total_feedback} feedback items analyzed` } },
      { type: 'divider' },
      ...(['critical', 'high', 'medium', 'low'] as const).map(level => {
        const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[level];
        const items = (summary.priority_matrix || [])
          .filter((m: any) => m.priority === level)
          .map((m: any) => `• ${m.product_area}: ${m.issue_count} issues`)
          .join('\n');
        return items ? { type: 'section', text: { type: 'mrkdwn', text: `${emoji} *${level.toUpperCase()}*\n${items}` } } : null;
      }).filter(Boolean),
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: `📈 *Sentiment*: ${JSON.stringify(summary.by_sentiment)}\n💬 *Sources*: ${JSON.stringify(summary.by_source)}` } },
      ...(summary.action_items?.length ? [
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: `🎯 *Action Items*\n${summary.action_items.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}` } }
      ] : [])
    ]
  };
}
