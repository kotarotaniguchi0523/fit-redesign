// dashboard 集計の公開型定義。集計ロジック（dashboardAggregator 他）と描画コンポーネントが
// 共有する。実装モジュール間の循環依存を避けるため型だけをここに集約する（leaf モジュール）。

// カバレッジ分母（全問題数）= D1 questions テーブルの行数。exam8-2013 の5問も含む。
// 注: 単元別 totalQuestions（examMapping 由来の examId×5）の合計とは一致しないことがある
// （共有 exam の last-wins・実問題が無い examMapping エントリのため）。分母の真実は D1 行数=180。
export const TOTAL_QUESTIONS = 180;

export interface ParsedQuestionId {
	examId: string; // "exam1-2013"
	examNumber: number;
	year: string;
	questionNumber: number;
}

export interface MonthlyStats {
	month: string; // "YYYY-MM"
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number; // 0-100
	avgDuration: number | null; // seconds
}

export interface UnitStats {
	unitId: string;
	unitName: string;
	unitIcon: string;
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number;
	trend: "improving" | "stable" | "declining";
	questionDetails: {
		questionId: string;
		answers: { selectedLabel: string; isCorrect: boolean; createdAt: number }[];
	}[];
}

// 推移グラフの粒度別バケット（日/週）。X軸ラベル付きで chart.js に流す。
export interface PeriodStats {
	key: string; // ソート用 "YYYY-MM-DD"（日 or 週の月曜日）
	label: string; // 表示ラベル: 日 "6/11" / 週 "6/8〜"
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number; // 0-100
	avgDuration: number | null; // seconds
}

// 学習ヒートマップの1セル（直近15週×7曜日）。
export interface HeatmapCell {
	dateKey: string; // "YYYY-MM-DD"
	label: string; // "6/11"（title 属性用）
	count: number; // その日の回答数
	weekday: number; // 月曜起点の曜日(月=0..日=6)。集計層が epoch ms 基準で算出
}

// 単元の仕上がり（②仕上がりの内訳・③弱点単元 Top3 で使う）。
export interface UnitMastery {
	unitId: string;
	unitName: string;
	unitIcon: string;
	masteryRate: number; // 0-100 仕上がり率（着手問題の問題スコア平均）
	attempted: number; // 着手問題数
	totalQuestions: number; // 単元の全問題数
	linkYear: string; // 演習ページ代表年度＝examMapping 先頭
}

// 苦手問題（③苦手問題 Top5）。
export interface WeakQuestion {
	questionId: string;
	label: string; // 人間可読 "符号理論 2013 Q1"
	unitName: string;
	score: number; // 0-100 問題スコア
	hasty: boolean; // 早とちり注意（40秒未満×不正解が複数回）
	trapLabel: string | null; // ひっかかり選択肢（同一誤答ラベル2回以上）
}

// 演習カバレッジ（広さ）。
export interface Coverage {
	attempted: number; // 着手問題数（ユニーク）
	total: number; // 全問題数（180）
}

// 完走したセット（exam 単位5問）の通しタイム（②の単元行「前回の通しタイム」用）。
export interface SetTime {
	unitId: string;
	year: string;
	examNumber: number;
	totalSeconds: number; // 5問のラップ合計
	completedAt: number; // セット最終回答の created_at（単元内で最新セットを選ぶため）
}

export interface DashboardData {
	totalAnswered: number; // 回答済み問題数（ユニークな questionId）
	totalAttempts: number; // 総回答回数
	overallAccuracy: number; // 全体正答率（最新回答ベース）
	avgDuration: number | null;
	monthlyStats: MonthlyStats[];
	unitStats: UnitStats[];
	trend: "improving" | "stable" | "declining";
	dailyStats: PeriodStats[]; // 直近30日（JST）
	weeklyStats: PeriodStats[]; // 直近12週（JST・月曜起点）
	heatmap: HeatmapCell[]; // 直近15週=105日（0埋め・now 基準）
	todayCount: number; // 今日(JST)解いたユニーク問題数（目標リング分子）
	coverage: Coverage; // 着手/180
	unitMastery: UnitMastery[]; // 全単元の仕上がり（②）
	weakUnits: UnitMastery[]; // 弱点単元 Top3（③・2問以上着手の低い順）
	weakQuestions: WeakQuestion[]; // 苦手問題 Top5（③・2回以上解答の低い順）
	setTimes: SetTime[]; // 単元ごとの直近完走セットの通しタイム（②展開行）
	overallMastery: number | null; // 着手加重平均の仕上がり率(0-100)。着手0なら null
	masteryAttempted: number; // overallMastery の分母＝単元に写像できる着手問題数（表示「着手したN問」）
}
