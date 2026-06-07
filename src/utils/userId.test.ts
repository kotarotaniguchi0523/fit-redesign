import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_ID_KEY } from "../constants";
import { getUserId } from "./userId";

/**
 * getUserId の characterization テスト。
 * 二重定義（answerClient / timerStorage）を共有モジュールへ一本化する前後で
 * 観測可能な契約（戻り値・localStorage 永続化）が不変であることを pin する。
 * 古典派: out-of-process 依存（localStorage）は jsdom の実体を使い、
 * crypto.randomUUID のみ決定的にスタブして入出力を AAA で検証する。
 */

describe("getUserId", () => {
	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("既存IDが保存されていればそれを返す（新規生成しない）", () => {
		// Arrange
		localStorage.setItem(USER_ID_KEY, "existing-user-id");
		const uuid = vi.spyOn(crypto, "randomUUID");

		// Act
		const result = getUserId();

		// Assert
		expect(result).toBe("existing-user-id");
		expect(uuid).not.toHaveBeenCalled();
	});

	it("未保存なら新規UUIDを生成し localStorage に永続化して返す", () => {
		// Arrange
		vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");

		// Act
		const result = getUserId();

		// Assert
		expect(result).toBe("11111111-1111-4111-8111-111111111111");
		expect(localStorage.getItem(USER_ID_KEY)).toBe("11111111-1111-4111-8111-111111111111");
	});

	it("生成後の再呼び出しは localStorage から同一IDを返し、再生成しない", () => {
		// Arrange: UUID は初回のみ生成される想定（2回生成されたら別IDになる）
		const uuid = vi
			.spyOn(crypto, "randomUUID")
			.mockReturnValueOnce("22222222-2222-4222-8222-222222222222");

		// Act
		const first = getUserId();
		const second = getUserId();

		// Assert: 2回目は永続化済みの値を読み、randomUUID は1回しか呼ばれない
		expect(first).toBe("22222222-2222-4222-8222-222222222222");
		expect(second).toBe(first);
		expect(uuid).toHaveBeenCalledTimes(1);
	});

	it("localStorage アクセスが失敗する環境では 'anonymous' を返す（永続化しない）", () => {
		// Arrange
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("localStorage unavailable");
		});

		// Act
		const result = getUserId();

		// Assert
		expect(result).toBe("anonymous");
	});
});
