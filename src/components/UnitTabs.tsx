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
				{tabs.map((tab) => (
					<Tab key={tab.id} title={tab.name}>
						<div className="p-4">
							{/* 講義スライド */}
							{isUnit(tab) && tab.slides.length > 0 && <SlideSection slides={tab.slides} />}
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
				))}
				{/* 講義資料のみタブ */}
				<Tab key="slide-only" title="講義資料のみ">
					<div className="p-4">
						{slideOnlyUnits.map((unit) => (
							<SlideSection key={unit.id} slides={unit.slides} />
						))}
					</div>
				</Tab>
			</Tabs>
		</div>
	);
}
