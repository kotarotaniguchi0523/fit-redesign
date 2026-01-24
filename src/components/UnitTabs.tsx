import { Card, CardBody } from "@heroui/react";
import { motion } from "framer-motion";
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

// 講義資料のみカードのデータ
const slideOnlyTab = {
	id: "slide-only",
	name: "講義資料のみ",
	icon: "📚",
	description: "スライドのみ提供",
};

// 全てのユニット（通常のユニット + 講義資料のみ）
const allUnits = [...unitBasedTabs, slideOnlyTab];

export function UnitTabs({ selectedYear, onYearChange }: Props) {
	const [selectedKey, setSelectedKey] = useState<string | number>(unitBasedTabs[0]?.id ?? "");

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

	return (
		<div className="w-full">
			{/* カードグリッド */}
			<div
				className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6"
				role="tablist"
				aria-label="単元選択"
			>
				{allUnits.map((unit) => (
					<motion.div
						key={unit.id}
						role="tab"
						aria-selected={selectedKey === unit.id}
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						transition={{ duration: 0.2 }}
					>
						<Card
							isPressable
							isHoverable
							className={`border-2 transition-all cursor-pointer ${
								selectedKey === unit.id
									? "border-[#c9a227] bg-[#1e3a5f]/5 shadow-md"
									: "border-gray-200 hover:border-gray-300"
							}`}
							onPress={() => handleSelectionChange(unit.id)}
						>
							<CardBody className="p-4 text-center">
								<span className="text-3xl mb-2 block">{unit.icon}</span>
								<h4 className="font-semibold text-[#1e3a5f] text-sm mb-1">{unit.name}</h4>
								<p className="text-xs text-gray-500">{unit.description}</p>
							</CardBody>
						</Card>
					</motion.div>
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

					{/* 小テスト */}
					{examNumbers.map((examNumber) => {
						const examData = getExamByNumber(examNumber);
						if (!examData) return null;

						return (
							<ExamSection
								key={examNumber}
								availableYears={examData.availableYears}
								exam={examData.exams[selectedYear]}
								onYearChange={onYearChange}
								selectedYear={selectedYear}
								title={examData.title}
							/>
						);
					})}
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
