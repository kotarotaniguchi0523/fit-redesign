import type { Question } from "../../types/index";

/**
 * 小テスト5: 符号理論（Error Correcting Code）
 * 2015年度版（Exam5c-ECC.pdf）
 */

export const exam5_2015: Question[] = [
	{
		id: "exam5-2015-q1",
		number: 1,
		text: "平均符号長を求めよ。単位を明記せよ。",
		answer: "1.75 ビット/シンボル",
		explanation:
			"各文字の生起確率と符号長から平均符号長を計算する。平均符号長 = Σ(生起確率 × 符号長)",
	},
	{
		id: "exam5-2015-q2",
		number: 2,
		text: "次の検査式の中で、一つだけ等価でないものはどれか？",
		options: [
			{ label: "ア", value: "x1 = x2 ⊕ c", isCorrect: true },
			{ label: "イ", value: "0 ⊕ x1 = x2 ⊕ c ⊕ 1" },
			{ label: "ウ", value: "x1 ⊕ x2 ⊕ 1 = c" },
			{ label: "エ", value: "x1 ⊕ x2 ⊕ c = 1" },
		],
		answer: "ア",
		explanation:
			"アの式は x1 = x2 ⊕ c であり、他の3つの式（イ、ウ、エ）は x1 ⊕ x2 ⊕ c = 1 と等価だが、アのみ異なる",
	},
	{
		id: "exam5-2015-q3",
		number: 3,
		text: "外乱による影響を検出してから修正動作を行う制御方式は次のどれか？",
		options: [
			{ label: "ア", value: "フィードバック制御", isCorrect: true },
			{ label: "イ", value: "フィードフォワード制御" },
			{ label: "ウ", value: "シーケンス制御" },
			{ label: "エ", value: "PWM制御" },
		],
		answer: "ア",
		explanation:
			"フィードバック制御は、出力結果を検出してからそれを基に修正動作を行う制御方式。外乱の影響を検出後に対応する",
	},
	{
		id: "exam5-2015-q4",
		number: 4,
		text: "先頭ポインタと末尾ポインタを持つ n 個のデータを格納した単方向リスト構造がある。次の操作の内、ポインタを参照する回数が最も多いものはどれか？",
		options: [
			{ label: "ア", value: "リストの先頭にデータを挿入する" },
			{ label: "イ", value: "リストの先頭のデータを削除する" },
			{ label: "ウ", value: "リストの末尾にデータを挿入する" },
			{ label: "エ", value: "リストの末尾のデータを削除する", isCorrect: true },
		],
		answer: "エ",
		explanation:
			"単方向リストで末尾のデータを削除するには、先頭から順にポインタを辿って末尾の一つ前の要素を見つける必要があり、n-1回のポインタ参照が必要。他の操作は定数回で済む",
	},
	{
		id: "exam5-2015-q5",
		number: 5,
		text: "単一誤りを訂正できる方式を次の選択肢から全て挙げよ。",
		options: [
			{ label: "ア", value: "偶数パリティ" },
			{ label: "イ", value: "奇数パリティ" },
			{ label: "ウ", value: "水平垂直パリティ", isCorrect: true },
			{ label: "エ", value: "CRC符号" },
		],
		answer: "ウ",
		explanation:
			"水平垂直パリティ（二次元パリティ）は誤りの位置を特定できるため、単一誤りを訂正できる。偶数・奇数パリティやCRC符号は誤り検出のみで訂正はできない",
	},
];
