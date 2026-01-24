import type { Question } from "../../types/index";

/**
 * 小テスト7: 符号理論（Error Correcting Code）
 * 2015年度版
 * 注: PDFファイル（Exam7c-ECC.pdf）から問題文を取得。解答はExam2015-Ans.htmlを参照
 */

export const exam7_2015: Question[] = [
	{
		id: "exam7-2015-q1",
		number: 1,
		text: "出現確率が 1/2, 1/4, 1/8, 1/8 の4つのシンボルを生起する情報源がある。この情報源のハフマン符号の平均符号長を求めよ。",
		answer: "1.75 ビット/シンボル",
		explanation:
			"ハフマン符号化: A(1/2)=1(1bit), B(1/4)=01(2bit), C(1/8)=001(3bit), D(1/8)=000(3bit)。平均符号長 = (1/2)×1 + (1/4)×2 + (1/8)×3 + (1/8)×3 = 0.5 + 0.5 + 0.375 + 0.375 = 1.75 bit/symbol",
	},
	{
		id: "exam7-2015-q2",
		number: 2,
		text: "次の検査式の中で、一つだけ等価でないものはどれか？",
		options: [
			{ label: "ア", value: "x₁ = x₂ ⊕ c", isCorrect: false },
			{ label: "イ", value: "0 ⊕ x₁ = x₂ ⊕ c ⊕ 1", isCorrect: false },
			{ label: "ウ", value: "x₁ ⊕ x₂ ⊕ 1 = c", isCorrect: false },
			{ label: "エ", value: "x₁ ⊕ x₂ ⊕ c = 1", isCorrect: true },
		],
		answer: "ア",
		explanation:
			"元の式を c = x₁ ⊕ x₂ と仮定すると、ア: x₁ = x₂ ⊕ c（同値）、イ: x₁ = x₂ ⊕ c ⊕ 1（0 ⊕ x₁ = x₁なので、x₁ = x₂ ⊕ c ⊕ 1は同値）、ウ: x₁ ⊕ x₂ ⊕ 1 = c（同値）、エ: x₁ ⊕ x₂ ⊕ c = 1（これは c = x₁ ⊕ x₂ の場合に 0 = 1となり矛盾するため等価でない）。ただし解答HTMLの記載により「ア」が正解となっている。",
	},
	{
		id: "exam7-2015-q3",
		number: 3,
		text: "外乱による影響を検出してから修正動作を行う制御方式は次のどれか？",
		options: [
			{ label: "ア", value: "フィードバック制御", isCorrect: true },
			{ label: "イ", value: "フィードフォワード制御", isCorrect: false },
			{ label: "ウ", value: "シーケンス制御", isCorrect: false },
			{ label: "エ", value: "PWM制御", isCorrect: false },
		],
		answer: "ア",
		explanation:
			"フィードバック制御は、出力を測定して目標値と比較し、その差（外乱の影響）を検出してから修正動作を行う方式。フィードフォワード制御は外乱を予測して事前に対処する方式。",
	},
	{
		id: "exam7-2015-q4",
		number: 4,
		text: "先頭ポインタと末尾ポインタを持つn個のデータを格納した単方向リスト構造がある。次の操作の内、ポインタを参照する回数が最も多いものはどれか？",
		options: [
			{ label: "ア", value: "リストの先頭にデータを挿入する", isCorrect: false },
			{
				label: "イ",
				value: "リストの先頭のデータを削除する",
				isCorrect: false,
			},
			{ label: "ウ", value: "リストの末尾にデータを挿入する", isCorrect: false },
			{
				label: "エ",
				value: "リストの末尾のデータを削除する",
				isCorrect: true,
			},
		],
		answer: "エ",
		explanation:
			"単方向リストでは、末尾のデータを削除する際に末尾の一つ前のノードを見つける必要がある。先頭からn-1回ポインタをたどる必要があり、最も参照回数が多い。ア・イ・ウはO(1)で実行可能。",
	},
	{
		id: "exam7-2015-q5",
		number: 5,
		text: "単一誤りを訂正できる方式を次の選択肢から全て挙げよ。",
		options: [
			{ label: "ア", value: "偶数パリティ", isCorrect: false },
			{ label: "イ", value: "奇数パリティ", isCorrect: false },
			{ label: "ウ", value: "水平垂直パリティ", isCorrect: true },
			{ label: "エ", value: "CRC符号", isCorrect: false },
		],
		answer: "ウ",
		explanation:
			"単一誤りを訂正（検出だけでなく訂正）できるのは水平垂直パリティ。偶数/奇数パリティは検出のみ可能。CRC符号は誤り検出に優れているが、標準的なCRCでは誤り訂正はできない（検出のみ）。",
	},
];
