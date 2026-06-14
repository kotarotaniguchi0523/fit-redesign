-- answers テーブルに set_id 列を追加（NULL 許容。既存行は null で後方互換）。
-- set_id はラップ式ストップウォッチが1セット(exam の小テスト=5問)ごとにクライアント生成する文字列。
-- リモート D1 への適用は main マージ時に CI が wrangler d1 migrations apply で自動実行する（手動で --remote しない）。
-- ローカルは pnpm db:migrate:local で適用。
ALTER TABLE answers ADD COLUMN set_id TEXT;
