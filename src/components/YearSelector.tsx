import { Radio, RadioGroup } from "@heroui/react";
import type { Year } from "../types/index";

interface Props {
	selectedYear: Year;
	onYearChange: (year: Year) => void;
	availableYears?: Year[];
}

const allYears: Year[] = ["2013", "2014", "2015", "2016", "2017"];

export function YearSelector({ selectedYear, onYearChange, availableYears = allYears }: Props) {
	return (
		<RadioGroup
			label="年度を選択"
			orientation="horizontal"
			value={selectedYear}
			onValueChange={(value) => onYearChange(value as Year)}
		>
			{allYears.map((year) => (
				<Radio key={year} value={year} isDisabled={!availableYears.includes(year)}>
					{year}年度
				</Radio>
			))}
		</RadioGroup>
	);
}
