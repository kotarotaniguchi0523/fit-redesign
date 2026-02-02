import { Card } from "@heroui/react";
import { useState } from "react";
import { getExamByNumber } from "../data/exams";
import { slideOnlyUnits, unitBasedTabs } from "../data/units";
import type { Unit, Year } from "../types/index";
import { ExamSection } from "./ExamSection";
import { SlideSection } from "./SlideSection";
import { YearSelector } from "./YearSelector";

interface Props {
	selectedYear: Year;
	onYearChange: (year: Year) => void;
}

// 講義資料のみタブのデータ
const slideOnlyTab = {
	id: "slide-only",
	name: "講義資料のみ",
};

// 全てのユニット（通常のユニット + 講義資料のみ）
const allUnits = [...unitBasedTabs, slideOnlyTab];

export function UnitTabs({ selectedYear, onYearChange }: Props) {
	const [selectedKey, setSelectedKey] = useState<string | number>(unitBasedTabs[0]?.id ?? "");
	// ユーザーが選択した小テスト番号（nullなら未選択）
	const [selectedExamNumber, setSelectedExamNumber] = useState<number | null>(null);

	const handleSelectionChange = (key: string | number) => {
		setSelectedKey(key);

		// 新しいタブの有効年度を取得
		const newUnit = unitBasedTabs.find((u) => u.id === key);
		if (newUnit) {
			const availableYears = newUnit.examMapping.map((m) => m.year);
			// 現在の年度が無効なら、最初の有効年度へ補正
			if (!availableYears.includes(selectedYear)) {
				onYearChange(availableYears[0]);
			}
		}
	};

	// 選択された単元の情報を取得
	const selectedUnit = unitBasedTabs.find((unit) => unit.id === selectedKey);
	const isSlideOnly = selectedKey === "slide-only";

	// 選択された単元の利用可能な年度と試験情報を取得
	const availableYears = selectedUnit?.examMapping.map((m) => m.year) ?? [];
	const examMapping = selectedUnit?.examMapping.find((m) => m.year === selectedYear);
	const examNumbers = examMapping?.examNumbers ?? [];

	// レンダリング中に計算（useEffect不要）
	// selectedExamNumberが有効なら維持、無効なら最初の値にフォールバック
	const activeExamNumber =
		selectedExamNumber !== null && examNumbers.includes(selectedExamNumber)
			? selectedExamNumber
			: (examNumbers[0] ?? null);

	const activeExamData = activeExamNumber ? getExamByNumber(activeExamNumber) : undefined;
	const activeExam = activeExamData?.exams[selectedYear];
	const activeExamTitle = activeExam?.title ?? activeExamData?.title ?? "";

	return (
		<div className="w-full">
			{/* シンプルなボタングループ */}
			<div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="単元選択">
				{allUnits.map((unit) => (
					<button
						key={unit.id}
						type="button"
						role="tab"
						aria-selected={selectedKey === unit.id}
						onClick={() => handleSelectionChange(unit.id)}
						className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
							selectedKey === unit.id
								? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
								: "bg-white text-gray-700 border-gray-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
						}`}
					>
						{unit.name}
					</button>
				))}
			</div>

			{/* 選択された単元のコンテンツ */}
			{!isSlideOnly && selectedUnit && (
				<div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
					{/* 講義スライド */}
					{selectedUnit.slides.length > 0 && <SlideSection slides={selectedUnit.slides} />}

					{/* 年度選択 */}
					<div className="mt-4">
						<YearSelector
							selectedYear={selectedYear}
							onYearChange={onYearChange}
							availableYears={availableYears}
						/>
					</div>

					{/* 統合試験の注意表示 */}
					{examMapping?.integratedTitle && (
						<Card className="mt-4 bg-blue-50 border border-blue-200 shadow-sm">
							<div className="p-3">
								<div className="flex items-start gap-2">
									<div className="text-blue-600 font-medium mt-0.5">ℹ️</div>
									<div className="flex-1">
										<p className="text-sm text-blue-800">
											<span className="font-semibold">注意:</span> この年度では
											<span className="font-semibold">「{examMapping.integratedTitle}」</span>
											として統合試験になっています。
										</p>
									</div>
								</div>
							</div>
						</Card>
					)}

					{/* 小テスト切り替え */}
					{examNumbers.length > 1 && (
						<div className="mt-4">
							<p className="text-sm font-medium text-gray-600 mb-2">小テストを切り替え</p>
							<div
								className="grid grid-cols-1 sm:grid-cols-2 gap-2"
								role="tablist"
								aria-label="小テスト選択"
							>
								{examNumbers.map((examNumber) => {
									const examData = getExamByNumber(examNumber);
									if (!examData) return null;
									const examTitle = examData.exams[selectedYear]?.title ?? examData.title;
									const isActive = activeExamNumber === examNumber;

									return (
										<button
											key={examNumber}
											type="button"
											role="tab"
											aria-selected={isActive}
											onClick={() => setSelectedExamNumber(examNumber)}
											className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex flex-col text-left w-full ${
												isActive
													? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
													: "bg-white text-gray-700 border-gray-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
											}`}
										>
											<span className="text-[11px] opacity-80">小テスト{examNumber}</span>
											<span className="text-sm leading-snug">{examTitle}</span>
										</button>
									);
								})}
							</div>
						</div>
					)}

					{/* 小テスト */}
					{activeExamData && <ExamSection exam={activeExam} title={activeExamTitle} />}
				</div>
			)}

			{/* 講義資料のみの場合 */}
			{isSlideOnly && (
				<div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
					{slideOnlyUnits.map((unit: Unit) => (
						<SlideSection key={unit.id} slides={unit.slides} />
					))}
				</div>
			)}
		</div>
	);
}
