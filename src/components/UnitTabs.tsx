import { Tab, Tabs } from "@heroui/react";
import { getExamByNumber } from "../data/exams";
import { slideOnlyUnits, tabGroups2014, units2013 } from "../data/units";
import type { ExamByYear, TabGroup, Unit, Year } from "../types/index";
import { ExamSection } from "./ExamSection";
import { SlideSection } from "./SlideSection";

interface Props {
	selectedYear: Year;
	onYearChange: (year: Year) => void;
}

function isUnit(tab: Unit | TabGroup): tab is Unit {
	return !("units" in tab);
}

/**
 * タブに対応するExamByYearを取得
 * @param tab Unit または TabGroup
 * @returns 対応するExamByYear、見つからない場合はundefined
 */
function getExamForTab(tab: Unit | TabGroup): ExamByYear | undefined {
	if (isUnit(tab)) {
		// 2013年度のUnitの場合、examsプロパティを直接返す
		return tab.exams;
	}
	// 2014年度以降のTabGroupの場合、examNumberから取得
	return getExamByNumber(tab.examNumber);
}

export function UnitTabs({ selectedYear, onYearChange }: Props) {
	const is2013 = selectedYear === "2013";
	const tabs: (Unit | TabGroup)[] = is2013 ? units2013 : tabGroups2014;

	return (
		<div className="w-full">
			<Tabs aria-label="単元" color="primary" variant="underlined">
				{tabs.map((tab) => {
					// TabGroupの場合は、含まれるunitsから講義スライドを集約
					const slides = isUnit(tab) ? tab.slides : tab.units.flatMap((unit) => unit.slides);
					// タブに対応するexamデータを取得
					const examData = getExamForTab(tab);

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
										title={isUnit(tab) ? `小テスト: ${tab.name}` : tab.title}
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
