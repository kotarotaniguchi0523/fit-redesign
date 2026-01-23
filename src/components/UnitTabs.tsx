import { Tab, Tabs } from "@heroui/react";
import { exam1 } from "../data/exams";
import { slideOnlyUnits, tabGroups2014, units2013 } from "../data/units";
import type { TabGroup, Unit, Year } from "../types/index";
import { ExamSection } from "./ExamSection";
import { SlideSection } from "./SlideSection";

interface Props {
	selectedYear: Year;
	onYearChange: (year: Year) => void;
}

function isUnit(tab: Unit | TabGroup): tab is Unit {
	return !("units" in tab);
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

					return (
						<Tab key={tab.id} title={tab.name}>
							<div className="p-4">
								{/* 講義スライド */}
								{slides.length > 0 && <SlideSection slides={slides} />}
								{/* 小テスト */}
								<ExamSection
									availableYears={exam1.availableYears}
									exam={exam1.exams[selectedYear]}
									onYearChange={onYearChange}
									selectedYear={selectedYear}
									title={`小テスト: ${tab.name}`}
								/>
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
