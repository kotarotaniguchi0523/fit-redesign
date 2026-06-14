import type { AnswerRecord } from "../../types/answer";

/**
 * 習熟度モデル（問題スコア）の純関数。
 *
 * 問題スコア(0..1) = (1 - SPEED_WEIGHT) × 正確性 + SPEED_WEIGHT × 速度。
 *   正確性 = 0.6 × 直近正答率（直近3回）+ 0.4 × 累計正答率（本人の全履歴）
 *   速度   = tier / 4。tier は「直近の正解した回答の duration（秒）」を10秒区切りで離散化
 * 速度を出せない（正解が無い / 直近正解の duration が NULL）ときは速度項を外して正規化する
 * （0.7 で割り戻す ＝ 正確性のみで評価）。アンカー: 全正解・全60秒以上 → 0.70 / 全30秒未満 → 1.00。
 *
 * フレームワーク非依存の純関数として保つ。単元別の平均で仕上がり率（Σ問題スコア ÷ 着手問題数）を
 * 出すのは集計層（dashboardAggregator）の役割で Phase 2 で配線する（本モジュールは問題スコアまで）。
 */

// 速度の配分（チューニング可能な単一の真実）。w=0.3。Dawes(1979) の頑健性より単一定数で十分。
export const SPEED_WEIGHT = 0.3;
const ACCURACY_WEIGHT = 1 - SPEED_WEIGHT; // 0.7
// 正確性の内訳: 直近重視（0.6）+ 累計（0.4）。
const RECENT_RATE_WEIGHT = 0.6;
const CUMULATIVE_RATE_WEIGHT = 0.4;
const RECENT_WINDOW = 3;
// tier は 0..4 の5段階。速度 = tier / 4 で 0..1 に正規化。
const MAX_SPEED_TIER = 4;

/**
 * duration（秒）→ 速度 tier(0..4)。10秒区切りで速いほど高い。
 * 60秒以上=0 / 50–59=1 / 40–49=2 / 30–39=3 / 30秒未満=4。
 */
export function speedTier(durationSeconds: number): number {
	if (durationSeconds >= 60) {
		return 0;
	}
	if (durationSeconds >= 50) {
		return 1;
	}
	if (durationSeconds >= 40) {
		return 2;
	}
	if (durationSeconds >= 30) {
		return 3;
	}
	return 4;
}

/** 正確性 = 0.6 × 直近正答率（直近3回）+ 0.4 × 累計正答率（全履歴）。 */
export function questionAccuracy(records: AnswerRecord[]): number {
	if (records.length === 0) {
		return 0;
	}
	const cumulativeRate = records.filter((r) => r.isCorrect).length / records.length;
	const recent = records.slice(-RECENT_WINDOW);
	const recentRate = recent.filter((r) => r.isCorrect).length / recent.length;
	return RECENT_RATE_WEIGHT * recentRate + CUMULATIVE_RATE_WEIGHT * cumulativeRate;
}

/**
 * 直近の正解した回答の duration から速度(0..1)を求める。
 * 正解が無い / 直近正解の duration が NULL のときは null（速度項なし）。
 */
function latestCorrectSpeed(records: AnswerRecord[]): number | null {
	// created_at 昇順前提なので末尾側から最初の正解＝直近の正解（中間配列を作らず findLast）。
	const latestCorrect = records.findLast((r) => r.isCorrect);
	if (!latestCorrect || latestCorrect.duration == null) {
		return null;
	}
	return speedTier(latestCorrect.duration) / MAX_SPEED_TIER;
}

/**
 * 1問の問題スコア(0..1)。本人のその問題への全回答（created_at 昇順）を渡す。
 * 速度を出せない場合は正確性のみ（0.7 で割り戻し済みの値 = 正確性そのもの）。
 */
export function questionScore(records: AnswerRecord[]): number {
	if (records.length === 0) {
		return 0;
	}
	const accuracy = questionAccuracy(records);
	const speed = latestCorrectSpeed(records);
	if (speed == null) {
		return accuracy;
	}
	return ACCURACY_WEIGHT * accuracy + SPEED_WEIGHT * speed;
}
