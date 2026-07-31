import { useEffect, useState, useTransition } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import {
	PROGRESS_STORAGE_KEY,
	type ProgressEntry,
	readProgress,
	SYNC_KEY_STORAGE_KEY,
} from "../answer/progressClient";

type RecordsViewProps = Readonly<{
	unitNames: Record<string, string>;
}>;

type PendingAction = "create" | "sync" | "delete";
type Feedback = Readonly<{
	kind: "success" | "error";
	message: string;
}>;

const QUESTION_ID_PATTERN = /^exam(\d+)-(\d{4})-q(\d+)$/;

function mergeEntries(local: ProgressEntry[], remote: ProgressEntry[]): ProgressEntry[] {
	const merged = new Map<string, ProgressEntry>();
	for (const entry of [...local, ...remote]) {
		const current = merged.get(entry.questionId);
		if (!current || entry.revealedAt > current.revealedAt) {
			merged.set(entry.questionId, entry);
		}
	}
	return [...merged.values()].sort((a, b) => b.revealedAt - a.revealedAt);
}

function saveEntries(entries: ProgressEntry[]): void {
	localStorage.setItem(
		PROGRESS_STORAGE_KEY,
		JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.questionId, entry]))),
	);
}

function questionDetails(
	entry: ProgressEntry,
	unitNames: Record<string, string>,
): { label: string; href: string } {
	const match = QUESTION_ID_PATTERN.exec(entry.questionId);
	const year = match?.[2];
	return {
		label: match
			? `${unitNames[entry.unitId] ?? "小テスト"}・${year}年度・第${match[1]}回 問${match[3]}`
			: entry.questionId,
		href: year ? `/${entry.unitId}/${year}#question-${entry.questionId}` : "/",
	};
}

async function sync(key: string, local: ProgressEntry[]): Promise<ProgressEntry[]> {
	const response = await fetch("/progress/sync", {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Sync-Key": key },
		body: JSON.stringify({ entries: local }),
	});
	if (!response.ok) {
		throw new Error(response.status === 404 ? "同期リンクが無効です" : "同期できませんでした");
	}
	const body = (await response.json()) as { entries: ProgressEntry[] };
	return mergeEntries(local, body.entries);
}

export default function RecordsView({ unitNames }: RecordsViewProps): JSX.Element {
	const [entries, setEntries] = useState<ProgressEntry[]>([]);
	const [syncKey, setSyncKey] = useState<string | null>(null);
	const [origin, setOrigin] = useState("");
	const [feedback, setFeedback] = useState<Feedback | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const [isPending, startTransition] = useTransition();

	const runAction = (
		action: PendingAction,
		task: () => Promise<void>,
		fallbackMessage: string,
	): void => {
		startTransition(async (): Promise<void> => {
			setPendingAction(action);
			setFeedback(null);
			try {
				await task();
			} catch (error) {
				setFeedback({
					kind: "error",
					message: error instanceof Error ? error.message : fallbackMessage,
				});
			} finally {
				setPendingAction(null);
			}
		});
	};

	const applySync = (key: string, local: ProgressEntry[]): Promise<void> =>
		sync(key, local).then((merged) => {
			saveEntries(merged);
			setEntries(merged);
			setFeedback({ kind: "success", message: "この端末と同期しました" });
		});

	useEffect((): void => {
		setOrigin(location.origin);
		const local = Object.values(readProgress()).sort((a, b) => b.revealedAt - a.revealedAt);
		setEntries(local);
		const fragment = new URLSearchParams(location.hash.slice(1));
		const incomingKey = fragment.get("sync");
		if (location.hash) {
			history.replaceState(null, "", `${location.pathname}${location.search}`);
		}

		const storedKey = localStorage.getItem(SYNC_KEY_STORAGE_KEY);
		if (incomingKey) {
			if (window.confirm("この同期リンクの記録を、この端末の記録と統合しますか？")) {
				localStorage.setItem(SYNC_KEY_STORAGE_KEY, incomingKey);
				setSyncKey(incomingKey);
				runAction("sync", () => applySync(incomingKey, local), "同期できませんでした");
			} else {
				setSyncKey(storedKey);
			}
		} else {
			setSyncKey(storedKey);
			if (storedKey) {
				runAction("sync", () => applySync(storedKey, local), "同期できませんでした");
			}
		}
	}, []);

	const latest = entries[0];
	const shareUrl = syncKey && origin ? `${origin}/records#sync=${syncKey}` : "";

	const createLink = (): void => {
		runAction(
			"create",
			async (): Promise<void> => {
				const response = await fetch("/progress/spaces", { method: "POST" });
				if (!response.ok) {
					throw new Error("同期リンクを作成できませんでした");
				}
				const body = (await response.json()) as { key: string };
				localStorage.setItem(SYNC_KEY_STORAGE_KEY, body.key);
				setSyncKey(body.key);
				await applySync(body.key, entries);
			},
			"同期リンクを作成できませんでした",
		);
	};

	const copyLink = async (): Promise<void> => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setFeedback({ kind: "success", message: "同期リンクをコピーしました" });
		} catch {
			setFeedback({
				kind: "error",
				message: "コピーできませんでした。下のリンクを選択してコピーしてください",
			});
		}
	};

	const disconnect = (): void => {
		localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
		setSyncKey(null);
		setFeedback({ kind: "success", message: "同期を解除しました。端末内の記録は残っています" });
	};

	const deleteLink = (): void => {
		if (!(syncKey && window.confirm("同期先の記録を削除しますか？ この端末の記録は残ります。"))) {
			return;
		}
		runAction(
			"delete",
			async (): Promise<void> => {
				const response = await fetch("/progress", {
					method: "DELETE",
					headers: { "X-Sync-Key": syncKey },
				});
				if (!response.ok) {
					throw new Error("同期先を削除できませんでした");
				}
				disconnect();
				setFeedback({
					kind: "success",
					message: "同期先を削除しました。端末内の記録は残っています",
				});
			},
			"同期先を削除できませんでした",
		);
	};

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
					{latest ? (
						((): JSX.Element => {
							const detail = questionDetails(latest, unitNames);
							return (
								<a
									class="mt-2 block font-bold text-[#1e3a5f] underline decoration-[#c9a227] underline-offset-4"
									href={detail.href}
								>
									{detail.label}
								</a>
							);
						})()
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
							const detail = questionDetails(entry, unitNames);
							return (
								<li class="py-3">
									<a class="font-medium text-[#1e3a5f] hover:underline" href={detail.href}>
										{detail.label}
									</a>
									<time class="mt-1 block text-xs text-gray-500">
										{new Date(entry.revealedAt).toLocaleString("ja-JP")}
									</time>
								</li>
							);
						})}
					</ol>
				) : (
					<p class="mt-3 text-gray-600">まだ記録はありません。</p>
				)}
			</section>

			<section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
				<h2 class="text-lg font-bold text-[#1e3a5f]">端末間で同期（任意）</h2>
				<p class="mt-2 text-sm leading-6 text-gray-600">
					ログインは不要です。秘密の同期リンクを別の端末で開くと、記録を統合できます。
				</p>
				<p class="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
					リンクを知っている人は記録を読み書きできます。他人に送らないでください。リンクを失うと復元できません。
				</p>
				{syncKey ? (
					<div class="mt-4 space-y-3">
						<input
							aria-label="秘密の同期リンク"
							class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
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
								class="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
							>
								リンクをコピー
							</button>
							<button
								type="button"
								disabled={isPending}
								onClick={(): void => {
									runAction("sync", () => applySync(syncKey, entries), "同期できませんでした");
								}}
								class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
							>
								{pendingAction === "sync" ? "同期中…" : "今すぐ同期"}
							</button>
							<button
								type="button"
								disabled={isPending}
								onClick={disconnect}
								class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
							>
								この端末の同期を解除
							</button>
							<button
								type="button"
								disabled={isPending}
								onClick={deleteLink}
								class="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
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
						class="mt-4 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
					>
						{pendingAction === "create" ? "作成中…" : "同期リンクを作る"}
					</button>
				)}
				{feedback && (
					<p
						role={feedback.kind === "error" ? "alert" : "status"}
						class={`mt-3 text-sm ${feedback.kind === "error" ? "text-red-700" : "text-gray-700"}`}
					>
						{feedback.message}
					</p>
				)}
			</section>
		</div>
	);
}
