/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import { unitBasedTabs } from "../../data/units";
import type { ExamNumber, Year } from "../../types";
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
			<a
				href={`/${unitId}/${y}`}
				class={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
					isSelected
						? "border-[#c9a227] bg-[#f7eed1] text-[#6f5712]"
						: "border-gray-200 bg-white text-slate-700 shadow-sm hover:border-gray-300"
				}`}
			>
				{y}年度
			</a>
		);
	}
	return (
		<span class="cursor-not-allowed rounded-full border-2 border-gray-100 px-4 py-1.5 text-sm font-bold text-gray-300">
			{y}年度
		</span>
	);
}

// 小テスト切替タブ（複数 exam がある年度のみ描画）
export function ExamSwitchTabs({
	examNumbers,
	selectedExamNumber,
	unitId,
	year,
}: {
	examNumbers: ExamNumber[];
	selectedExamNumber: ExamNumber;
	unitId: string;
	year: Year;
}): JSX.Element | null {
	if (examNumbers.length <= 1) {
		return null;
	}
	return (
		<div class="mt-4">
			<p class="mb-2 text-sm font-bold text-[#1e3a5f]">小テストを選択</p>
			<div class="flex flex-row flex-wrap gap-2" role="tablist" aria-label="小テスト選択">
				{examNumbers.map((examNum) => {
					const isActive = examNum === selectedExamNumber;
					return (
						<a
							href={`/${unitId}/${year}?exam=${examNum}`}
							role="tab"
							aria-selected={isActive ? "true" : "false"}
							class={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
								isActive
									? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm"
									: "border-gray-200 bg-white text-slate-700 shadow-sm hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
							}`}
						>
							小テスト{examNum}
						</a>
					);
				})}
			</div>
		</div>
	);
}

// 単元タブ行（全単元のナビゲーション）
export function UnitTabBar({ currentUnitId }: { currentUnitId: string }): JSX.Element {
	return (
		<div
			class="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-2"
			role="tablist"
			aria-label="単元選択"
		>
			{unitBasedTabs.map((tab) => {
				const isActive = tab.id === currentUnitId;
				const targetYear = tab.examMapping[0]?.year ?? DEFAULT_YEAR;
				return (
					<a
						href={`/${tab.id}/${targetYear}`}
						role="tab"
						aria-selected={isActive ? "true" : "false"}
						class={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-center text-sm font-bold transition-all ${
							isActive
								? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm"
								: "border-gray-300 bg-white text-gray-700 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
						}`}
					>
						{tab.name}
					</a>
				);
			})}
			<a
				href="/slide-only"
				class="min-h-10 shrink-0 rounded-full border border-gray-300 bg-white px-4 py-2 text-center text-sm font-bold text-gray-700 transition-all hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
			>
				講義資料のみ
			</a>
		</div>
	);
}
