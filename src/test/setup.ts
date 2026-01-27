/**
 * Vitest 共通セットアップ
 * jsdom環境でのテスト用初期化処理
 */

// 各テスト前にlocalStorageをクリア
beforeEach(() => {
	localStorage.clear();
});

// crypto.randomUUID polyfill（jsdomに存在しない場合）
if (typeof crypto.randomUUID !== "function") {
	Object.defineProperty(crypto, "randomUUID", {
		value: () => {
			// RFC4122 version 4 UUID
			return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
				const r = (Math.random() * 16) | 0;
				const v = c === "x" ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			});
		},
	});
}
