/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import { unitBasedTabs } from "../../data/units";
import type { Year } from "../../types";
import { YEARS } from "../../types";

// 単元ページの presentational なナビゲーション群（[year].tsx から co-location 切り出し）。
// island ではない純 SSR コンポーネント。`_` 接頭辞で HonoX のルーティングから除外される。

const DEFAULT_YEAR = YEARS[0];

// 年度ピルの単一エントリ
export function YearPill({
	y,
	unitId,
	isAvailable,
	isSelected,
}: {
	y: Year;
	unitId: string;
	isAvailable: boolean;
	isSelected: boolean;
}): JSX.Element {
	if (isAvailable) {
		return (
			<a href={`/${unitId}/${y}`} aria-current={isSelected ? "page" : undefined}>
				{y}年度
			</a>
		);
	}
	return (
		<span aria-disabled="true" class="cursor-not-allowed opacity-45">
			{y}年度
		</span>
	);
}

// 単元タブ行（全単元のナビゲーション）
export function StudyNavigator({
	currentUnitId,
	currentYear,
}: {
	currentUnitId: string;
	currentYear: Year;
}): JSX.Element {
	const currentUnit = unitBasedTabs.find((unit) => unit.id === currentUnitId);
	return (
		<details class="study-navigator">
			<summary>
				<span>
					<strong>{currentUnit?.name}</strong>
					<small>{currentYear}年度</small>
				</span>
				<span class="study-navigator__action">単元・年度を変更</span>
			</summary>
			<div class="study-navigator__panel">
				<div>
					<p class="study-navigator__label">単元</p>
					<div class="study-navigator__units">
						{unitBasedTabs.map((unit) => {
							const matchingYear = unit.examMapping.some((mapping) => mapping.year === currentYear)
								? currentYear
								: (unit.examMapping[0]?.year ?? DEFAULT_YEAR);
							return (
								<a
									href={`/${unit.id}/${matchingYear}`}
									aria-current={unit.id === currentUnitId ? "page" : undefined}
								>
									{unit.name}
								</a>
							);
						})}
					</div>
				</div>
				<div>
					<p class="study-navigator__label">年度</p>
					<div class="study-navigator__years">
						{YEARS.map((year) => (
							<YearPill
								y={year}
								unitId={currentUnitId}
								isAvailable={
									currentUnit?.examMapping.some((mapping) => mapping.year === year) ?? false
								}
								isSelected={year === currentYear}
							/>
						))}
					</div>
				</div>
			</div>
		</details>
	);
}
