import type { AnswerRecord } from "../../types/answer";
import { MAX_BOX, nextCard, type SrsCard, type SrsState } from "./leitner";

/**
 * D1 の回答履歴を SRS の box 状態へ「リプレイ導出」する純粋モジュール（サーバー側専用）。
 *
 * box 遷移は正誤系列だけで決まる純関数（leitner.ts の nextCard）なので、answers に全件記録された
 * 正誤イベントを時系列に畳めば box は localStorage 側と忠実に一致する。due/last は各回答の
 * created_at（サーバー時刻）を now として算出するため、絶対値は localStorage 側（client 時刻）と
 * client/server のクロック差ぶんずれうるが、ダッシュボードは同じサーバー時刻基準で滞留判定するため整合する。
 * localStorage 非依存なので [userId].tsx（SSR）から安全に呼べる。
 */

// 習熟ステージの内訳（ダッシュボード②「記憶の定着」用）。
export interface SrsStageBreakdown {
	learning: number; // box 1-2（学習中）
	takingHold: number; // box 3-4（定着しかけ）
	mastered: number; // box 5（定着）
}

export interface SrsSummary {
	seenCount: number; // 着手済み（state にあるカード数）
	overdueCount: number; // due <= now（復習の滞留）
	stages: SrsStageBreakdown;
}

/**
 * 回答履歴（questionId → created_at 昇順の AnswerRecord[]）を問題ごとに時系列リプレイし、
 * 各問題の最終 SrsCard を持つ SrsState を返す。
 * 同じ正誤系列を recordGrade に流した localStorage state と一致する。
 */
export function deriveSrsFromHistory(history: Record<string, AnswerRecord[]>): SrsState {
	return Object.fromEntries(
		Object.entries(history).flatMap(([questionId, records]) => {
			const card = records.reduce<SrsCard | undefined>(
				(acc, record) => nextCard(acc, record.isCorrect, record.createdAt),
				undefined,
			);
			// 空バケット（理論上は発生しない）は state に載せない。
			return card ? [[questionId, card] as const] : [];
		}),
	);
}

/**
 * SrsState から復習の滞留件数と習熟ステージ内訳を導出する。
 * 未学習（全問数 − 着手数）は全問母数を持つ集計層で算出するため、ここでは着手済みのみ扱う。
 */
export function summarizeSrs(state: SrsState, now: number): SrsSummary {
	const cards = Object.values(state);
	return {
		seenCount: cards.length,
		overdueCount: cards.filter((c) => c.due <= now).length,
		stages: {
			learning: cards.filter((c) => c.box <= 2).length,
			takingHold: cards.filter((c) => c.box === 3 || c.box === 4).length,
			mastered: cards.filter((c) => c.box >= MAX_BOX).length,
		},
	};
}
