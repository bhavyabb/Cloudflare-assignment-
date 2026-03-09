DROP TABLE IF EXISTS feedback;

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  urgency TEXT,
  computed_urgency TEXT,
  sentiment TEXT,
  sentiment_score REAL,
  category TEXT,
  product_area TEXT,
  theme_cluster TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX idx_feedback_source ON feedback(source);
CREATE INDEX idx_feedback_urgency ON feedback(computed_urgency);
CREATE INDEX idx_feedback_sentiment ON feedback(sentiment);
CREATE INDEX idx_feedback_created ON feedback(created_at);
CREATE INDEX idx_feedback_product ON feedback(product_area);
