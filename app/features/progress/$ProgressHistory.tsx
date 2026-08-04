import { useSyncExternalStore } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { latestProgress } from "./progress";
import { formatProgressDateTime, progressQuestionLink } from "./progressPresentation";
import {
	parseProgressSnapshot,
	readProgressSnapshot,
	subscribeToProgress,
} from "./progressStorage";

type ProgressHistoryProps = Readonly<{ unitNames: Readonly<Record<string, string>> }>;

export default function ProgressHistory({ unitNames }: ProgressHistoryProps): JSX.Element {
	const snapshot = useSyncExternalStore(subscribeToProgress, readProgressSnapshot, () => null);
	const entries = Object.values(parseProgressSnapshot(snapshot)).sort(
		(a, b) => b.revealedAt - a.revealedAt,
	);
	const latest = latestProgress(entries);
	const latestLink = latest ? progressQuestionLink(latest, unitNames) : null;

	return (
		<div class="space-y-6">
			<section class="grid gap-4 sm:grid-cols-2">
				<div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm text-gray-500">答えを確認した問題</p>
					<p class="mt-2 text-3xl font-bold text-[#1e3a5f]">
						{entries.length}
						<span class="ml-1 text-base">問</span>
					</p>
				</div>
				<div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm text-gray-500">前回の続き</p>
					{latestLink ? (
						<a
							class="mt-2 block font-bold text-[#1e3a5f] underline decoration-[#c9a227] underline-offset-4"
							href={latestLink.href}
						>
							{latestLink.label}
						</a>
					) : (
						<p class="mt-2 text-gray-600">答えを確認すると、ここに表示されます。</p>
					)}
				</div>
			</section>

			<section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
				<h2 class="text-lg font-bold text-[#1e3a5f]">最近確認した問題</h2>
				{entries.length > 0 ? (
					<ol class="mt-3 divide-y divide-gray-100">
						{entries.slice(0, 10).map((entry): JSX.Element => {
							const detail = progressQuestionLink(entry, unitNames);
							return (
								<li class="py-3">
									<a class="font-medium text-[#1e3a5f] hover:underline" href={detail.href}>
										{detail.label}
									</a>
									<time class="mt-1 block text-xs text-gray-500">
										{formatProgressDateTime(entry.revealedAt)}
									</time>
								</li>
							);
						})}
					</ol>
				) : (
					<p class="mt-3 text-gray-600">まだ記録はありません。</p>
				)}
			</section>
		</div>
	);
}
