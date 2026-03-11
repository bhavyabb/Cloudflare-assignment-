export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: Ai;
  FEEDBACK_PIPELINE: Workflow;
}

export interface FeedbackRow {
  id: number;
  source: string;
  author: string;
  content: string;
  urgency: string | null;
  computed_urgency: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  category: string | null;
  product_area: string | null;
  theme_cluster: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface PriorityMatrixItem {
  product_area: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  issue_count: number;
  top_issues: string[];
  recommendation?: string;
}

export interface DailySummary {
  generated_at: string;
  total_feedback: number;
  by_source: Record<string, number>;
  by_sentiment: Record<string, number>;
  by_urgency: Record<string, number>;
  priority_matrix: PriorityMatrixItem[];
  action_items: string[];
}
