import { Tab, Tabs } from "@heroui/react";
import { useEffect, useState } from "react";
import { getExamByNumber } from "../data/exams";
import { slideOnlyUnits, tabs2013, tabs2014 } from "../data/units";
import type { Unit, Year } from "../types/index";
import { ExamSection } from "./ExamSection";
import { SlideSection } from "./SlideSection";

interface Props {
	selectedYear: Year;
	onYearChange: (year: Year) => void;
}

export function UnitTabs({ selectedYear, onYearChange }: Props) {
	const is2013 = selectedYear === "2013";
	const tabs = is2013 ? tabs2013 : tabs2014;

	const [selectedKey, setSelectedKey] = useState<string | number>(tabs[0]?.id ?? "");

	useEffect(() => {
		// 年度が変わったら最初のタブにリセット
		setSelectedKey(tabs[0]?.id ?? "");
	}, [selectedYear, tabs]);

	const handleSelectionChange = (key: string | number) => {
		setSelectedKey(key);
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
				{tabs.map((tab) => {
					// スライド取得（統一された構造なので分岐不要）
					const slides = tab.slides;
					// 試験データ取得（統一された構造なので分岐不要）
					const examData = tab.examNumber ? getExamByNumber(tab.examNumber) : undefined;

					return (
						<Tab key={tab.id} title={tab.name}>
							<div className="p-4">
								{/* 講義スライド */}
								{slides.length > 0 && <SlideSection slides={slides} />}
								{/* 小テスト */}
								{examData && (
									<ExamSection
										availableYears={examData.availableYears}
										exam={examData.exams[selectedYear]}
										onYearChange={onYearChange}
										selectedYear={selectedYear}
										title={tab.title}
									/>
								)}
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
