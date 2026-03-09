-- 回答記録テーブル（1行 = 1回答）
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_label TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  duration REAL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_answers_user_question ON answers(user_id, question_id);
CREATE INDEX idx_answers_user_timestamp ON answers(user_id, timestamp);
