/**
 * Leitner ボックス遷移の純粋コア（I/O 一切なし）。
 *
 * localStorage 依存を持たないため、サーバー側のリプレイ導出（Phase 1b で追加予定の replay.ts）
 * からも安全に import できる。`srs.ts` はこのモジュールに localStorage 永続化を被せた薄い層。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const MAX_BOX = 5;
// 不正解時に「すぐまた出す」ための短い猶予
const RELEARN_MS = 10 * 60 * 1000;

export interface SrsCard {
	box: number;
	due: number; // 次回出題予定 (epoch ms)
	last: number; // 最終回答 (epoch ms)
}

export type SrsState = Record<string, SrsCard>;

/**
 * box(1..MAX_BOX) → 次回出題までの間隔を計算する。
 * 1日 × 2^(box-1) で指数的に増加する（box1=1日, box2=2日, box3=4日, ...）。
 * BOX_INTERVAL_MS テーブルを廃止し、MAX_BOX との二重管理を解消する。
 */
function boxIntervalMs(box: number): number {
	return DAY_MS * 2 ** (box - 1);
}

/**
 * 壊れた box 値（NaN・負数・小数・範囲外）を 1..MAX_BOX に丸める。
 * localStorage が破損した場合でも due=NaN になるのを防ぐ。
 */
function clampBox(box: number): number {
	// NaN や無限大は isFinite で弾く。小数は floor で整数化。負数・0 は 1 に補正。
	const integer = Number.isFinite(box) ? Math.floor(box) : 1;
	return Math.min(Math.max(integer, 1), MAX_BOX);
}

/**
 * 値が有効な SrsCard かを検査する型ガード。
 * - box は 1..MAX_BOX の有限整数
 * - due / last は有限数
 * localStorage から読んだ値を検証してから使う。
 */
export function isValidSrsCard(value: unknown): value is SrsCard {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	const box = candidate.box;
	const due = candidate.due;
	const last = candidate.last;
	// box は 1..MAX_BOX の有限整数であること
	if (
		typeof box !== "number" ||
		!Number.isFinite(box) ||
		!Number.isInteger(box) ||
		box < 1 ||
		box > MAX_BOX
	) {
		return false;
	}
	// due / last は有限数であること
	if (typeof due !== "number" || !Number.isFinite(due)) {
		return false;
	}
	if (typeof last !== "number" || !Number.isFinite(last)) {
		return false;
	}
	return true;
}

/**
 * 1回の採点で Leitner カードがどう遷移するかを決める純関数。
 * - 正解: box を +1（上限 MAX_BOX）、due は box に応じた間隔後
 * - 不正解: box を 1 にリセット、due は RELEARN_MS 後
 * 未学習（current=undefined）への正解は box=1 から始まる。
 * current.box が壊れた値の場合は clampBox で補正し due=NaN を防ぐ。
 */
export function nextCard(current: SrsCard | undefined, isCorrect: boolean, now: number): SrsCard {
	// 壊れた box 値（NaN/負/小数/範囲外）でも clampBox が 1..MAX_BOX に補正し due=NaN を防ぐ。
	const box = isCorrect ? clampBox((current?.box ?? 0) + 1) : 1;
	const due = isCorrect ? now + boxIntervalMs(box) : now + RELEARN_MS;
	return { box, due, last: now };
}
