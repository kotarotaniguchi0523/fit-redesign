import { useState, useSyncExternalStore } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { formatLocalDateTime } from "../../lib/dateTime";
import {
	aggregateChallengeResults,
	formatAccuracy,
	formatDuration,
	summarizeChallenge,
} from "./challenge";
import {
	readChallengeHistorySnapshot,
	readCompletedChallenges,
	subscribeToChallenges,
} from "./challengeStorage";
import type { CompletedChallengePayload } from "./types";

type ResultFilter = "all" | "exam" | "question";
const QUESTION_NUMBER_PATTERN = /-q(\d+)$/;

function isQuestionMode(challenge: CompletedChallengePayload): boolean {
	return challenge.answers.length === 1;
}

function matchesFilter(challenge: CompletedChallengePayload, filter: ResultFilter): boolean {
	return (
		filter === "all" ||
		(filter === "question" ? isQuestionMode(challenge) : !isQuestionMode(challenge))
	);
}

function challengeLabel(challenge: CompletedChallengePayload): string {
	const [examNumber, year] = challenge.examId.replace("exam", "").split("-");
	return isQuestionMode(challenge)
		? `小テスト${examNumber}・${year}年度 / 単問`
		: `小テスト${examNumber}・${year}年度`;
}

function questionLabel(questionId: string): string {
	const match = QUESTION_NUMBER_PATTERN.exec(questionId);
	return match ? `問${match[1]}` : questionId;
}

export default function ChallengeHistory(): JSX.Element {
	const snapshot = useSyncExternalStore(
		subscribeToChallenges,
		readChallengeHistorySnapshot,
		() => null,
	);
	const [filter, setFilter] = useState<ResultFilter>("all");
	const completed = readCompletedChallenges()
		.filter((challenge) => matchesFilter(challenge, filter))
		.sort((a, b) => b.updatedAt - a.updatedAt);
	const aggregate = aggregateChallengeResults(completed);
	const filterOptions: readonly { value: ResultFilter; label: string }[] = [
		{ value: "all", label: "すべて" },
		{ value: "exam", label: "小テスト" },
		{ value: "question", label: "単問計測" },
	];

	return (
		<section class="space-y-4" aria-labelledby="challenge-history-title">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p class="text-xs font-bold uppercase tracking-[0.16em] text-[#806612]">
						Challenge records
					</p>
					<h2 id="challenge-history-title" class="mt-1 text-xl font-bold text-[#1e3a5f]">
						小テストの結果
					</h2>
					<p class="mt-1 text-sm text-gray-500">
						自己判定した完了済みの試行を、あとから振り返れます。
					</p>
				</div>
				<fieldset class="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
					<legend class="sr-only">結果の絞り込み</legend>
					{filterOptions.map((option) => (
						<button
							type="button"
							class={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${filter === option.value ? "bg-white text-[#1e3a5f] shadow-sm" : "text-gray-500 hover:text-[#1e3a5f]"}`}
							aria-pressed={filter === option.value ? "true" : "false"}
							onClick={(): void => setFilter(option.value)}
						>
							{option.label}
						</button>
					))}
				</fieldset>
			</div>

			{snapshot === null || completed.length === 0 ? (
				<p class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center text-sm text-gray-600">
					{snapshot === null
						? "小テストを完了すると、ここに結果が表示されます。"
						: "この条件の完了済み結果はまだありません。"}
				</p>
			) : (
				<>
					<div class="grid gap-3 sm:grid-cols-4">
						<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-gray-500">試行回数</p>
							<p class="mt-2 text-2xl font-bold text-[#1e3a5f]">{aggregate.challengeCount}</p>
						</div>
						<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-gray-500">正解率</p>
							<p class="mt-2 text-2xl font-bold text-[#1e3a5f]">
								{formatAccuracy(aggregate.accuracy)}
							</p>
						</div>
						<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-gray-500">判定数</p>
							<p class="mt-2 text-2xl font-bold text-[#1e3a5f]">{aggregate.judgedCount}</p>
						</div>
						<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-gray-500">合計時間</p>
							<p class="mt-2 font-mono text-xl font-bold text-[#1e3a5f]">
								{formatDuration(aggregate.totalElapsedMs)}
							</p>
						</div>
					</div>

					<div class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
						<section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
							<h3 class="font-bold text-[#1e3a5f]">最近の試行</h3>
							<ol class="mt-3 divide-y divide-gray-100">
								{completed.slice(0, 8).map((challenge) => {
									const summary = summarizeChallenge(challenge);
									return (
										<li class="flex items-center justify-between gap-3 py-3 text-sm">
											<div class="min-w-0">
												<p class="truncate font-bold text-gray-700">{challengeLabel(challenge)}</p>
												<time class="mt-1 block text-xs text-gray-500">
													{formatLocalDateTime(challenge.updatedAt)}
												</time>
											</div>
											<div class="shrink-0 text-right">
												<p class="font-bold text-[#1e3a5f]">
													{summary.correctCount} / {summary.judgedCount}
												</p>
												<p class="mt-1 font-mono text-xs text-gray-500">
													{formatDuration(summary.totalElapsedMs)}
												</p>
											</div>
										</li>
									);
								})}
							</ol>
						</section>

						<section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
							<h3 class="font-bold text-[#1e3a5f]">問題別の累計</h3>
							<ol class="mt-3 divide-y divide-gray-100">
								{Object.values(aggregate.byQuestion)
									.sort((a, b) => a.questionId.localeCompare(b.questionId))
									.slice(0, 12)
									.map((question) => (
										<li class="flex items-center justify-between gap-3 py-3 text-sm">
											<span class="font-bold text-gray-700">
												{questionLabel(question.questionId)}
											</span>
											<span class="text-right text-xs text-gray-500">
												{question.correctCount}○ / {question.incorrectCount}× · 平均{" "}
												{formatDuration(question.averageElapsedMs ?? 0)}
											</span>
										</li>
									))}
							</ol>
						</section>
					</div>
				</>
			)}
		</section>
	);
}
