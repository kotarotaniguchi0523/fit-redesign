-- 小テストの完了結果と答え確認履歴を、責務ごとに分離した最終スキーマへ移行する。
-- 現行の sync_spaces / question_progress には保持すべき記録がない前提で作り直す。
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS question_progress;
DROP TABLE IF EXISTS sync_links;
DROP TABLE IF EXISTS sync_spaces;

CREATE TABLE sync_links (
  id         TEXT    NOT NULL PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE question_progress (
  sync_link_id TEXT    NOT NULL,
  question_id  TEXT    NOT NULL,
  unit_id      TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (sync_link_id, question_id),
  FOREIGN KEY (sync_link_id) REFERENCES sync_links(id) ON DELETE CASCADE,
  CHECK (created_at <= updated_at)
);

CREATE INDEX idx_question_progress_recent
  ON question_progress(sync_link_id, updated_at DESC);

CREATE TABLE challenges (
  id           TEXT    NOT NULL PRIMARY KEY,
  sync_link_id TEXT    NOT NULL,
  exam_id      TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (sync_link_id) REFERENCES sync_links(id) ON DELETE CASCADE,
  CHECK (created_at <= updated_at)
);

CREATE INDEX idx_challenges_scope
  ON challenges(sync_link_id, exam_id, updated_at DESC);

CREATE TABLE answers (
  challenge_id TEXT    NOT NULL,
  question_id  TEXT    NOT NULL,
  elapsed_ms   INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  judgment     TEXT    NOT NULL CHECK (judgment IN ('correct', 'incorrect')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, question_id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  CHECK (created_at <= updated_at)
);
