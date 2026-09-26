/**
 * Vitest 共通セットアップ
 * jsdom環境でのテスト用初期化処理
 */
import { afterEach, beforeEach } from "vitest";

function clearStorage(): void {
	if (typeof localStorage !== "undefined") {
		localStorage.clear();
	}
	if (typeof sessionStorage !== "undefined") {
		sessionStorage.clear();
	}
}

function resetBrowserEnvironment(): void {
	clearStorage();
	if (typeof document !== "undefined") {
		document.body.replaceChildren();
	}
	if (typeof window !== "undefined") {
		window.history.replaceState(null, "", "/");
	}
}

// テスト開始時と終了時に状態を戻し、失敗したテストの残留値も次へ持ち越さない。
beforeEach(resetBrowserEnvironment);
afterEach(resetBrowserEnvironment);

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
