import { Radio, RadioGroup } from "@heroui/react";
import { isYear, YEARS, type Year } from "../types/index";

interface Props {
	selectedYear: Year;
	onYearChange: (year: Year) => void;
	availableYears?: readonly Year[];
}

export function YearSelector({ selectedYear, onYearChange, availableYears = YEARS }: Props) {
	return (
		<div className="w-full">
			<RadioGroup
				label="年度を選択"
				orientation="horizontal"
				value={selectedYear}
				onValueChange={(value) => {
					if (isYear(value)) {
						onYearChange(value);
					}
				}}
				classNames={{
					label: "text-sm font-medium text-gray-600 mb-2",
					wrapper: "flex flex-row flex-wrap gap-3",
				}}
			>
				{YEARS.map((year) => (
					<Radio
						key={year}
						value={year}
						isDisabled={!availableYears.includes(year)}
						classNames={{
							base: "border-2 border-gray-200 data-[selected=true]:border-[#c9a227] rounded-full px-4 py-1.5 bg-white shadow-sm hover:border-gray-300 transition-colors m-0",
							wrapper: "hidden",
							label: "text-sm font-medium",
							labelWrapper: "m-0",
						}}
					>
						{year}年度
					</Radio>
				))}
			</RadioGroup>
		</div>
	);
}
