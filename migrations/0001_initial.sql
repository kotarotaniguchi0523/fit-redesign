-- ユーザーテーブル（匿名UUID）
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

-- 試行記録テーブル（1行 = 1 attempt）
CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  mode TEXT NOT NULL,
  target_time INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_attempts_user_question ON attempts(user_id, question_id);
CREATE INDEX idx_attempts_user_timestamp ON attempts(user_id, timestamp);
