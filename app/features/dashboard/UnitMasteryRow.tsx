/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import { UnitIcon } from "../../components/UnitIcon";
import type { SetTime, UnitMastery, UnitStats } from "./dashboardAggregator";
import { formatSetTime } from "./dashboardView";

interface UnitMasteryRowProps {
	mastery: UnitMastery;
	setTime: SetTime | undefined; // 最新の完走セット（なければ undefined）
	unitStats: UnitStats | undefined; // 問題別詳細（なければ undefined）
}

export function UnitMasteryRow({ mastery, setTime, unitStats }: UnitMasteryRowProps): JSX.Element {
	const isAttempted = mastery.attempted > 0;
	// 仕上がり率バーの幅（着手0問の場合は0%）
	const barWidth = isAttempted ? mastery.masteryRate : 0;

	return (
		<details class="bg-white rounded-lg shadow-sm overflow-hidden group">
			<summary class="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors list-none">
				{/* 単元アイコン */}
				<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f]">
					<UnitIcon unitId={mastery.unitId} className="h-5 w-5" />
				</span>

				{/* 単元名 + 仕上がり率バー + "N/M問着手" */}
				<div class="flex-1 min-w-0">
					<div class="flex items-center justify-between gap-2">
						<span class="font-medium text-gray-900 truncate">{mastery.unitName}</span>
						<span class="text-sm font-semibold text-[#1e3a5f] shrink-0">
							{isAttempted ? `${mastery.masteryRate}%` : "—"}
						</span>
					</div>
					<div class="flex items-center gap-2 mt-1">
						{/* 仕上がり率バー */}
						<div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
							<div
								class="h-full bg-emerald-500 rounded-full transition-all"
								style={`width: ${barWidth}%`}
							/>
						</div>
						<span class="text-xs text-gray-500 shrink-0">
							{mastery.attempted}/{mastery.totalQuestions}問着手
						</span>
					</div>
				</div>
			</summary>

			{/* 展開コンテンツ */}
			<div class="border-t border-gray-100 p-4 space-y-3">
				{/* 前回の通しタイム */}
				{setTime && (
					<p class="text-sm text-gray-600">
						前回の通しタイム:{" "}
						<span class="font-medium text-[#1e3a5f]">{formatSetTime(setTime.totalSeconds)}</span>（
						{setTime.year}年度・小テスト{setTime.examNumber}）
					</p>
				)}

				{/* 問題別テーブル */}
				{unitStats && unitStats.questionDetails.length > 0 && (
					<table class="w-full text-sm">
						<thead>
							<tr class="text-gray-500 border-b">
								<th class="text-left py-1 font-medium">問題</th>
								<th class="text-center py-1 font-medium">回答数</th>
								<th class="text-center py-1 font-medium">最新</th>
							</tr>
						</thead>
						<tbody>
							{unitStats.questionDetails.map((question) => {
								const latest = question.answers.at(-1);
								return (
									<tr key={question.questionId} class="border-b border-gray-50">
										<td class="py-1.5 text-gray-700">{question.questionId}</td>
										<td class="py-1.5 text-center text-gray-600">{question.answers.length}</td>
										<td class="py-1.5 text-center">
											{latest ? (
												<span class={latest.isCorrect ? "text-emerald-600" : "text-red-600"}>
													{latest.selectedLabel} {latest.isCorrect ? "○" : "×"}
												</span>
											) : (
												<span class="text-gray-400">-</span>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}

				{/* 着手なし */}
				{!isAttempted && <p class="text-sm text-gray-400">まだ着手していません</p>}
			</div>
		</details>
	);
}
