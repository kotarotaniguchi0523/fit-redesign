import { useActionState } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import type { UnitStats } from "./dashboardAggregator";

interface UnitDetailsProps {
	unit: UnitStats;
	trendIcon: string;
	trendClass: string;
}

function toggleReducer(open: boolean, _action: "toggle"): boolean {
	return !open;
}

export default function UnitDetails({
	unit,
	trendIcon,
	trendClass,
}: UnitDetailsProps): JSX.Element {
	const [open, toggle] = useActionState(toggleReducer, false);

	return (
		<div class="bg-white rounded-lg shadow-sm overflow-hidden">
			<button
				type="button"
				class="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
				onClick={(): void => toggle("toggle")}
				aria-expanded={open ? "true" : "false"}
			>
				<div class="flex items-center gap-3">
					<span class="text-xl">{unit.unitIcon}</span>
					<div>
						<div class="font-medium text-gray-900">{unit.unitName}</div>
						<div class="text-sm text-gray-500">{unit.totalAnswers}回 回答</div>
					</div>
				</div>
				<div class="flex items-center gap-4">
					<div class="w-24 hidden sm:block">
						<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
							<div
								class="h-full bg-emerald-500 rounded-full transition-all"
								style={`width: ${unit.accuracy}%`}
							/>
						</div>
						<div class="text-xs text-gray-500 text-right mt-0.5">{unit.accuracy}%</div>
					</div>
					<span class={`text-lg ${trendClass}`}>{trendIcon}</span>
					<span class="text-gray-400 text-sm">{open ? "▼" : "▶"}</span>
				</div>
			</button>
			{open ? (
				<div class="border-t border-gray-100 p-4">
					<table class="w-full text-sm">
						<thead>
							<tr class="text-gray-500 border-b">
								<th class="text-left py-1 font-medium">問題</th>
								<th class="text-center py-1 font-medium">回答数</th>
								<th class="text-center py-1 font-medium">最新</th>
							</tr>
						</thead>
						<tbody>
							{unit.questionDetails.map((q) => {
								const latest = q.answers[q.answers.length - 1];
								return (
									<tr class="border-b border-gray-50">
										<td class="py-1.5 text-gray-700">{q.questionId}</td>
										<td class="py-1.5 text-center text-gray-600">{q.answers.length}</td>
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
				</div>
			) : null}
		</div>
	);
}
