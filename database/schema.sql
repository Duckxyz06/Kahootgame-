CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quizzes_updated_at_idx ON quizzes (updated_at DESC);
