-- attempts の (user_id, question_id, timestamp) に一意制約を張り、同一試行の重複挿入を
-- DB レベルで不可能にする。旧 syncAttempts の 'INSERT ... WHERE NOT EXISTS' は TOCTOU
-- レース（同時 sync が両方 NOT EXISTS を通過して二重 INSERT）で重複行を生みえた。
-- INSERT OR IGNORE への置換がこの一意インデックスに依存する。

-- 1) 既存の重複行を id 最小の 1 行へ集約してから制約を張る（既存データで CREATE UNIQUE
--    INDEX が失敗しないように先に dedup する）。
DELETE FROM attempts
WHERE id NOT IN (
  SELECT MIN(id) FROM attempts GROUP BY user_id, question_id, timestamp
);

-- 2) 以後の重複挿入を不可能にする一意インデックス。
CREATE UNIQUE INDEX idx_attempts_unique ON attempts(user_id, question_id, timestamp);

-- 3) idx_attempts_user_question(user_id, question_id) は上の一意インデックスの左端
--    プレフィックスに完全に包含されるため冗長。唯一の利用者 clearUserQuestionRecords の
--    'DELETE WHERE user_id=? AND question_id=?' も一意インデックスでカバーされる。
--    書き込み増幅（不要な B-tree 維持）を避けるため削除する。
DROP INDEX idx_attempts_user_question;
