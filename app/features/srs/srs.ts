import { getUserId } from "../../lib/userId";

/**
 * 間隔反復(SRS)エンジン。Leitnerボックス方式。
 * スケジュール状態は localStorage に userId 別で保持し、バックエンドは増やさない。
 * 「確実に身につく（忘れた頃に再出題）」をペルソナ向けに最小実装する。
 */

// localStorage キーのプレフィックス（テストが本番と同一キーを使えるよう公開）。
export const SRS_KEY_PREFIX = "fit-srs-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

// box(1..5) → 次回出題までの間隔。box が上がるほど間隔が伸びる。
const BOX_INTERVAL_MS: Record<number, number> = {
	1: DAY_MS,
	2: 2 * DAY_MS,
	3: 4 * DAY_MS,
	4: 8 * DAY_MS,
	5: 16 * DAY_MS,
};
const MAX_BOX = 5;
// 不正解時に「すぐまた出す」ための短い猶予
const RELEARN_MS = 10 * 60 * 1000;

export interface SrsCard {
	box: number;
	due: number; // 次回出題予定 (epoch ms)
	last: number; // 最終回答 (epoch ms)
}

export type SrsState = Record<string, SrsCard>;

function storageKey(): string {
	return `${SRS_KEY_PREFIX}:${getUserId()}`;
}

export function loadSrsState(): SrsState {
	try {
		const raw = localStorage.getItem(storageKey());
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? (parsed as SrsState) : {};
	} catch {
		return {};
	}
}

function saveSrsState(state: SrsState): void {
	try {
		localStorage.setItem(storageKey(), JSON.stringify(state));
	} catch {
		// localStorage 不可環境では SRS なしで動作（劣化のみ）
	}
}

/** 回答結果を記録し、次回出題日を更新する */
export function recordGrade(questionId: string, isCorrect: boolean, now: number): SrsState {
	const state = loadSrsState();
	const current = state[questionId];
	const box = isCorrect ? Math.min((current?.box ?? 0) + 1, MAX_BOX) : 1;
	const due = isCorrect ? now + BOX_INTERVAL_MS[box] : now + RELEARN_MS;
	state[questionId] = { box, due, last: now };
	saveSrsState(state);
	return state;
}

/** 出題対象か（未学習＝新規、または期限到来） */
export function isDue(state: SrsState, questionId: string, now: number): boolean {
	const card = state[questionId];
	if (!card) return true; // 新規
	return card.due <= now;
}

export function isNew(state: SrsState, questionId: string): boolean {
	return !state[questionId];
}

export interface DailySet {
	/** 今日解く問題ID（復習を優先し、新規は控えめに混ぜる） */
	questionIds: string[];
	dueReviewCount: number;
	newCount: number;
}

/**
 * 単元内の今日の出題セットを組む。
 * - 期限到来の復習を優先
 * - 新規は maxNew 件まで（一気に出して圧倒しないため）
 * - 合計 maxTotal 件で打ち切り
 */
export function buildDailySet(
	state: SrsState,
	questionIds: string[],
	now: number,
	options: { maxNew?: number; maxTotal?: number } = {},
): DailySet {
	const maxNew = options.maxNew ?? 6;
	const maxTotal = options.maxTotal ?? 15;

	const reviews = questionIds.filter((id) => !isNew(state, id) && isDue(state, id, now));
	const news = questionIds.filter((id) => isNew(state, id)).slice(0, maxNew);

	const combined = [...reviews, ...news].slice(0, maxTotal);
	// combined は reviews が先頭なので、切り詰め後の内訳は長さ比較だけで分かる（再スキャン不要）
	const dueReviewCount = Math.min(reviews.length, combined.length);
	return {
		questionIds: combined,
		dueReviewCount,
		newCount: combined.length - dueReviewCount,
	};
}

/**
 * 単元の「試験本番メーター」(0-100)。
 * box が高い（＝間隔をあけても解けている）ほど高い。未学習は0。
 */
export function unitReadiness(state: SrsState, questionIds: string[]): number {
	if (questionIds.length === 0) return 0;
	const score = questionIds.reduce((sum, id) => sum + Math.min(state[id]?.box ?? 0, MAX_BOX), 0);
	return Math.round((score / (questionIds.length * MAX_BOX)) * 100);
}

export interface QuestionGradedDetail {
	questionId: string;
	isCorrect: boolean;
}
