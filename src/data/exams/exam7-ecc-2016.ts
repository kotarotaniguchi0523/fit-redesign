import type { Question } from "../../types/index";

/**
 * 小テスト7: 符号理論（Error Correcting Code）
 * 2016年度版
 * 注: PDFファイル（Exam7d-ECC.pdf）から問題文を取得。解答はExam2016-Ans.htmlを参照
 */

export const exam7_2016: Question[] = [
	{
		id: "exam7-2016-q1",
		number: 1,
		text: "出現確率が次の表に従って生起する情報源がある。この情報源のハフマン符号化し、平均符号長Lを求めよ。",
		figureDescription: "文字と生起確率",
		figureData: {
			type: "huffmanTable",
			data: {
				characters: ["A", "B", "C", "D", "E"],
				probabilities: [0.76, 0.08, 0.05, 0.06, 0.05],
			},
		},
		answer: "1.48 bit/symbol",
		explanation:
			"ハフマン符号化: A=1(1bit), B=01(2bit), D=001(3bit), C=0001(4bit), E=0000(4bit)。平均符号長 = 0.76×1 + 0.08×2 + 0.06×3 + 0.05×4 + 0.05×4 = 0.76 + 0.16 + 0.18 + 0.20 + 0.20 = 1.48 bit/symbol",
	},
	{
		id: "exam7-2016-q2",
		number: 2,
		text: "(1)の符号化を用いて、情報ABDを符号化せよ",
		answer: "1011010",
		explanation: "A=1, B=011, D=010（ハフマン符号化の結果による）。ABD = 1 + 011 + 010 = 1011010",
	},
	{
		id: "exam7-2016-q3",
		number: 3,
		text: "式 c = x₁⊕x₂ と同値なものを全て選べ",
		options: [
			{ label: "ア", value: "x₁ = x₂ ⊕ c", isCorrect: true },
			{ label: "イ", value: "0 = x₁⊕x₂⊕c", isCorrect: true },
			{ label: "ウ", value: "x₁⊕x₂⊕1 = c" },
			{ label: "エ", value: "x₁⊕x₂⊕c = c" },
		],
		answer: "ア，イ",
		explanation:
			"XOR演算の性質: c = x₁⊕x₂ ⟺ x₁ = x₂⊕c（アは同値）。また c⊕c = 0 なので x₁⊕x₂⊕c = 0（イも同値）",
	},
	{
		id: "exam7-2016-q4",
		number: 4,
		text: "7ビットの値 4A₍₁₆₎の8ビット目に偶数パリティビットを追加した値を16進数で求めよ",
		answer: "CA",
		explanation:
			"4A₍₁₆₎ = 1001010₍₂₎（1が3個で奇数）。偶数パリティにするためパリティビット1を追加: 11001010₍₂₎ = CA₍₁₆₎",
	},
	{
		id: "exam7-2016-q5",
		number: 5,
		text: "二重誤りを検出できる方式を次の選択肢から全て挙げよ",
		options: [
			{ label: "ア", value: "偶数パリティ" },
			{ label: "イ", value: "奇数パリティ" },
			{ label: "ウ", value: "水平垂直パリティ", isCorrect: true },
			{ label: "エ", value: "CRC符号", isCorrect: true },
		],
		answer: "ウ，エ",
		explanation:
			"偶数/奇数パリティは二重誤りを検出できない（偶数個の誤りはパリティが変化しない）。水平垂直パリティとCRC符号は二重誤りを検出可能",
	},
];
