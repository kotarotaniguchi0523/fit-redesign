import type { Question } from "../../types/index";

/**
 * 小テスト6: FSM（有限オートマトン）
 * 2016年度版
 * 注: PDFファイル（Exam6d-FSM.pdf）から問題文を取得。解答はExam2016-Ans.htmlを参照
 */

export const exam6_2016: Question[] = [
	{
		id: "exam6-2016-q1",
		number: 1,
		text: "平均70点のテストで75点と採点された時の偏差値が60点だった。この時の標準偏差を求めよ",
		answer: "5",
		explanation: "偏差値 = 50 + 10×(得点-平均)/σ。60 = 50 + 10×(75-70)/σ、10 = 50/σ、σ = 5",
	},
	{
		id: "exam6-2016-q2",
		number: 2,
		text: "正規表現 [A-C]+[1-3]+@[A-C]*.*[A-C]+ で受理される文字列を全て選べ",
		options: [
			{ label: "ア", value: "3BB@AC.CA" },
			{ label: "イ", value: "B32@AAA" },
			{ label: "ウ", value: "33@AA." },
			{ label: "エ", value: "BB@AC.CA", isCorrect: true },
		],
		answer: "エ",
		explanation: "[A-C]+で文字1つ以上、[1-3]+で数字1つ以上、@、[A-C]*で文字0個以上、.（任意1文字）、*で0回以上、[A-C]+で文字1つ以上。エのみ全条件を満たす",
	},
	{
		id: "exam6-2016-q3",
		number: 3,
		text: "次のBNF記法で定義される<M>であらわされる文字列を全て選べ。\n<A> ::= A|B|C\n<N> ::= 1|2|3\n<D> ::= <A>|<A><D>|<D><N>\n<M> ::= <D>@<D>",
		options: [
			{ label: "ア", value: "32@AA" },
			{ label: "イ", value: "B3@CA", isCorrect: true },
			{ label: "ウ", value: "B32@A" },
			{ label: "エ", value: "ABA@CA", isCorrect: true },
		],
		answer: "イ，エ",
		explanation: "<D>は文字から始まり、文字か数字が続く形。イ(B3@CA)とエ(ABA@CA)が条件を満たす",
	},
	{
		id: "exam6-2016-q4",
		number: 4,
		text: "式 (A+B)*C-(D/A) を逆ポーランド表記法で表せ",
		answer: "AB+C*DA/-",
		explanation: "(A+B)→AB+、(A+B)*C→AB+C*、(D/A)→DA/、全体→AB+C*DA/-",
	},
	{
		id: "exam6-2016-q5",
		number: 5,
		text: "次の概念の中で、有限オートマトンでないものを選べ",
		options: [
			{ label: "ア", value: "BNF記法" },
			{ label: "イ", value: "スタック", isCorrect: true },
			{ label: "ウ", value: "正規表現" },
			{ label: "エ", value: "全加算器" },
		],
		answer: "イ",
		explanation: "スタックは無限のメモリを持つ可能性があり、有限オートマトンでは表現できない。BNF記法、正規表現、全加算器は有限オートマトンで表現可能",
	},
];
