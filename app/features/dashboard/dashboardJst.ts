// JST 固定の日付バケット用ユーティリティ（leaf モジュール・unit マップ非依存）。
// created_at は epoch ms。Worker は UTC 実行のため JST(UTC+9) へシフトして getUTC* で日付を取り、
// ランタイムのローカル TZ に依存させない。日キー・週キーは文字列比較でソート可能な "YYYY-MM-DD"。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

// epoch ms → JST 日付キー "YYYY-MM-DD"
export function jstDayKey(ms: number): string {
	const date = new Date(ms + JST_OFFSET_MS);
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

// epoch ms → その JST 週（月曜起点）の月曜日キー "YYYY-MM-DD"
export function jstWeekStartKey(ms: number): string {
	return jstDayKey(ms - jstWeekdayMondayBased(ms) * DAY_MS);
}

// JST 日付キー "YYYY-MM-DD" → "M/D" 表示ラベル
export function dayKeyToLabel(key: string): string {
	const parts = key.split("-");
	return `${Number(parts[1])}/${Number(parts[2])}`;
}

// その JST 日の 00:00 を指す epoch ms（ヒートマップの日列挙に使う）
export function jstMidnightMs(ms: number): number {
	return Math.floor((ms + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS;
}

// epoch ms → JST 日付の月曜起点曜日インデックス（月=0..日=6）。
export function jstWeekdayMondayBased(ms: number): number {
	const sundayBased = new Date(ms + JST_OFFSET_MS).getUTCDay(); // 0=日..6=土
	return (sundayBased + 6) % 7;
}
