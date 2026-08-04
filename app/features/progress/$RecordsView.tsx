import type { JSX } from "hono/jsx/jsx-runtime";
import { formatProgressDateTime, progressQuestionLink } from "./progressPresentation";
import { useRecordsController } from "./useRecordsController";

type RecordsViewProps = Readonly<{
	unitNames: Record<string, string>;
	origin: string;
}>;

export default function RecordsView({ unitNames, origin }: RecordsViewProps): JSX.Element {
	const {
		entries,
		latest,
		shareUrl,
		isConnected,
		feedback,
		pendingAction,
		isPending,
		createLink,
		copyLink,
		disconnect,
		deleteLink,
		syncNow,
	} = useRecordsController(origin);
	const latestLink = latest ? progressQuestionLink(latest, unitNames) : null;

	return (
		<div class="space-y-6" aria-busy={isPending ? "true" : "false"}>
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

			<details class="content-panel p-0!">
				<summary class="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-4">
					<span>
						<strong class="block text-[#1e3a5f]">端末間で同期</strong>
						<small class="text-gray-500">必要な場合だけ設定します</small>
					</span>
					<span class="study-navigator__action">設定を開く</span>
				</summary>
				<div class="border-t border-gray-200 px-5 pb-5 pt-4">
					<p class="text-sm leading-6 text-gray-600">
						ログインは不要です。秘密の同期リンクを別の端末で開くと、記録を統合できます。
					</p>
					<p class="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
						リンクを知っている人は記録を読み書きできます。他人に送らないでください。リンクを失うと復元できません。
					</p>
					{isConnected ? (
						<div class="mt-4 space-y-3">
							<input
								aria-label="秘密の同期リンク"
								class="min-h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
								readOnly
								value={shareUrl}
								onFocus={(event): void => {
									(event.target as HTMLInputElement).select();
								}}
							/>
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									disabled={isPending}
									onClick={copyLink}
									class="min-h-11 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
								>
									リンクをコピー
								</button>
								<button
									type="button"
									disabled={isPending}
									onClick={syncNow}
									class="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
								>
									{pendingAction === "sync" ? "同期中…" : "今すぐ同期"}
								</button>
								<button
									type="button"
									disabled={isPending}
									onClick={disconnect}
									class="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
								>
									この端末の同期を解除
								</button>
								<button
									type="button"
									disabled={isPending}
									onClick={deleteLink}
									class="min-h-11 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
								>
									{pendingAction === "delete" ? "削除中…" : "同期先を削除"}
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							disabled={isPending}
							onClick={createLink}
							class="mt-4 min-h-11 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
						>
							{pendingAction === "create" ? "作成中…" : "同期リンクを作る"}
						</button>
					)}
				</div>
			</details>
			{feedback && (
				<p
					role={feedback.kind === "error" ? "alert" : "status"}
					class={`rounded-lg border bg-white px-4 py-3 text-sm ${feedback.kind === "error" ? "border-red-200 text-red-700" : "border-slate-200 text-gray-700"}`}
				>
					{feedback.message}
				</p>
			)}
		</div>
	);
}
