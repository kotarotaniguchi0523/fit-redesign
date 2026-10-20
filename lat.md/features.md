# Feature invariants

問題データと学習状態の所有者を明確にし、画面やAPIで同じドメイン処理を重複させない。

## Question catalog

試験問題は`app/data/exams-json/`のJSONを正とし、読み込み時に既存のスキーマで検証する。ページや学習機能に別の問題データを複製しない。

- Catalog schema: [[app/data/exams/schema.ts]]
- Loading and validation: [[app/data/exams/loader.ts]]

## Progress and challenge state

進捗と小テスト状態はブラウザー内に保存され、サーバー同期は明示的な同期キーを持つ利用者だけが使う。同期APIは保存前にスキーマ、時間範囲、試験カタログとの整合性を検証する。ドメイン上のmerge処理はブラウザーAPIやDB I/Oから分ける。

- Progress domain and storage: [[app/features/progress/progress.ts]] [[app/features/progress/progressStorage.ts#readProgress]]
- Challenge storage: [[app/features/challenge/challengeStorage.ts#archiveCompletedChallenge]]
- API validation: [[app/routes/progress.ts#progress]]
- D1 persistence: [[app/server/progressRepository.ts#syncProgress]]
