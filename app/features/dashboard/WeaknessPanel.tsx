/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import { UnitIcon } from "../../components/UnitIcon";
import type { UnitMastery, WeakQuestion } from "./dashboardAggregator";
import { weakQuestionHref } from "./dashboardView";

interface WeaknessPanelProps {
	/** 弱点単元 Top3 */
	weakUnits: UnitMastery[];
	/** 全単元の仕上がり（未着手単元の導出に使う） */
	unitMastery: UnitMastery[];
	/** 苦手問題 Top5 */
	weakQuestions: WeakQuestion[];
}

/**
 * ダッシュボード ③ 弱点診断
 * - 弱点単元 Top3 + 未着手単元
 * - 苦手問題 Top5
 */
export function WeaknessPanel({
	weakUnits,
	unitMastery,
	weakQuestions,
}: WeaknessPanelProps): JSX.Element {
	// 未着手単元はコンポーネント内で導出する（ルートが着手フィルタを持つ必要がない）。
	const notStartedUnits = unitMastery.filter((unit) => unit.attempted === 0);
	return (
		<div class="mb-8">
			<h2 class="text-lg font-bold text-[#1e3a5f] mb-4">弱点診断</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* 弱点単元 Top3 */}
				<div class="bg-white rounded-lg shadow-sm p-6">
					<h3 class="text-sm font-semibold text-gray-700 mb-3">弱点単元 Top3</h3>
					{weakUnits.length > 0 ? (
						<ol class="space-y-2">
							{weakUnits.map((weakUnit, index) => (
								<li key={weakUnit.unitId} class="flex items-center justify-between gap-2">
									<span class="flex items-center gap-2 text-sm text-gray-700">
										<span class="font-bold text-[#1e3a5f] w-4 shrink-0">{index + 1}.</span>
										<UnitIcon unitId={weakUnit.unitId} className="h-4 w-4 text-gray-500" />
										<span>{weakUnit.unitName}</span>
									</span>
									<span class="flex items-center gap-2 shrink-0">
										<span class="text-sm font-semibold text-red-600">{weakUnit.masteryRate}%</span>
										<a
											href={`/${weakUnit.unitId}/${weakUnit.linkYear}`}
											class="text-xs text-[#1e3a5f] hover:underline"
										>
											解く →
										</a>
									</span>
								</li>
							))}
						</ol>
					) : (
						<p class="text-sm text-gray-400">2問以上着手した単元がまだありません</p>
					)}
					{/* 未着手単元 */}
					{notStartedUnits.length > 0 && (
						<p class="text-xs text-gray-400 mt-3">
							未着手: {notStartedUnits.map((unit) => unit.unitName).join("、")}
						</p>
					)}
				</div>

				{/* 苦手問題 Top5 */}
				<div class="bg-white rounded-lg shadow-sm p-6">
					<h3 class="text-sm font-semibold text-gray-700 mb-3">苦手問題 Top5</h3>
					{weakQuestions.length > 0 ? (
						<ol class="space-y-2">
							{weakQuestions.map((weakQuestion, index) => {
								const href = weakQuestionHref(weakQuestion.questionId);
								return (
									<li key={weakQuestion.questionId} class="flex items-start justify-between gap-2">
										<span class="text-sm text-gray-700 flex gap-1">
											<span class="font-bold text-[#1e3a5f] w-4 shrink-0">{index + 1}.</span>
											<span class="flex flex-col gap-0.5">
												<a href={href} class="hover:underline">
													{weakQuestion.label}
												</a>
												<span class="flex gap-1 flex-wrap">
													{weakQuestion.hasty && (
														<span class="inline-block px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
															早とちり注意
														</span>
													)}
													{weakQuestion.trapLabel && (
														<span class="inline-block px-1.5 py-0.5 bg-red-100 text-red-800 text-xs rounded">
															{weakQuestion.trapLabel}を2回選択
														</span>
													)}
												</span>
											</span>
										</span>
										<span class="text-sm font-semibold text-red-600 shrink-0">
											{weakQuestion.score}%
										</span>
									</li>
								);
							})}
						</ol>
					) : (
						<p class="text-sm text-gray-400">2回以上解答した問題がまだありません</p>
					)}
				</div>
			</div>
		</div>
	);
}
