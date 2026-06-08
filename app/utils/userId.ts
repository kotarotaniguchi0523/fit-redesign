import { USER_ID_KEY } from "../constants";

/**
 * 匿名ユーザーID。localStorage に保存し、なければ生成する。
 * ブラウザ/デバイス単位でユーザーを識別する。
 * localStorage が使えない環境では "anonymous" を返す（永続化なし・サーバー記録はスキップ）。
 */
export function getUserId(): string {
	try {
		const existing = localStorage.getItem(USER_ID_KEY);
		if (existing) return existing;

		const newId = crypto.randomUUID();
		localStorage.setItem(USER_ID_KEY, newId);
		return newId;
	} catch {
		return "anonymous";
	}
}
