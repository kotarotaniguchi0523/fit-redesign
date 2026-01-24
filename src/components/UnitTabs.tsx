import { Card, Tab, Tabs } from "@heroui/react";
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

	return (
		<div className="w-full">
			<Tabs
				aria-label="単元"
				variant="light"
				selectedKey={selectedKey}
				onSelectionChange={handleSelectionChange}
				classNames={{
					tabList: "gap-2 p-1 bg-white rounded-xl shadow-sm border border-gray-200",
					tab: "px-4 py-2 rounded-lg data-[hover=true]:bg-gray-100 transition-all",
					tabContent: "text-gray-600 group-data-[selected=true]:text-[#1e3a5f] font-medium",
					cursor: "bg-[#1e3a5f] rounded-lg shadow-md",
				}}
			>
				{unitBasedTabs.map((unit) => {
					// この単元で利用可能な年度を取得
					const availableYears = unit.examMapping.map((m) => m.year);

					// 選択された年度に対応する試験番号を取得
					const examMapping = unit.examMapping.find((m) => m.year === selectedYear);
					const examNumbers = examMapping?.examNumbers ?? [];

					return (
						<Tab key={unit.id} title={unit.name}>
							<div className="p-4">
								{/* 講義スライド */}
								{unit.slides.length > 0 && <SlideSection slides={unit.slides} />}

								{/* 年度選択 */}
								<div className="mt-4">
									<YearSelector
										selectedYear={selectedYear}
										onYearChange={onYearChange}
										availableYears={availableYears}
									/>
								</div>

								{/* 統合試験の注意表示（メタデータベース） */}
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

								{/* 小テスト（複数の試験番号がある場合、すべて表示） */}
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
						</Tab>
					);
				})}
				{/* 講義資料のみタブ */}
				<Tab key="slide-only" title="講義資料のみ">
					<div className="p-4">
						{slideOnlyUnits.map((unit: Unit) => (
							<SlideSection key={unit.id} slides={unit.slides} />
						))}
					</div>
				</Tab>
			</Tabs>
		</div>
	);
}
