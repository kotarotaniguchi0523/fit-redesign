import type { Question } from "../../types/index";

/**
 * 小テスト8: データ構造（スタック）
 * 2017年度版
 * 注: PDFファイルが不足しているため、解答HTMLから逆算して問題を推定
 */

export const exam8_2017: Question[] = [
	{
		id: "exam8-2017-q1",
		number: 1,
		text: "二分木の表現に関する問題",
		answer: "(27 (7 6 (20 19)) 51)",
		explanation: "二分木のS式表現または括弧表記の問題。PDFが不足しているため詳細不明",
		hasFigure: true,
		figureDescription: "二分木の図",
		figureData: {
			type: "binaryTree",
			root: {
				value: 27,
				left: {
					value: 7,
					left: { value: 6 },
					right: {
						value: 20,
						left: { value: 19 },
					},
				},
				right: { value: 51 },
			},
		},
	},
	{
		id: "exam8-2017-q2",
		number: 2,
		text: "ポインタ操作の問題",
		answer: "400番地ポインタを200に",
		explanation: "リンクリストまたはポインタ操作の問題",
	},
	{
		id: "exam8-2017-q3",
		number: 3,
		text: "変数の値を求める問題",
		answer: "x=み，y=ん",
		explanation: "データ構造の走査または探索の問題",
	},
	{
		id: "exam8-2017-q4",
		number: 4,
		text: "文字列処理の問題",
		answer: "ABA",
		explanation: "スタックまたはキューを使った文字列処理",
	},
	{
		id: "exam8-2017-q5",
		number: 5,
		text: "データ構造の種類を答える問題",
		answer: "スタック",
		explanation: "LIFO（後入れ先出し）の特性を持つデータ構造",
	},
];
