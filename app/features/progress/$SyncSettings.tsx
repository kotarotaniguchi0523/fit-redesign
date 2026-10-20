import type { JSX } from "hono/jsx/jsx-runtime";
import { type SyncCommand, useSyncSettings } from "./useSyncSettings";

export default function SyncSettings({ origin }: Readonly<{ origin: string }>): JSX.Element {
	const { shareUrl, feedback, pendingAction, isConnected, execute } = useSyncSettings(origin);
	const isPending = pendingAction !== null;
	const run =
		(command: SyncCommand): (() => void) =>
		(): void =>
			execute(command);

	return (
		<div aria-busy={isPending ? "true" : "false"}>
			{isConnected ? (
				<div class="mt-4 space-y-3">
					<input
						aria-label="秘密の同期リンク"
						class="min-h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
						readOnly
						value={shareUrl}
						onFocus={(event): void => {
							if (event.target instanceof HTMLInputElement) {
								event.target.select();
							}
						}}
					/>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={isPending}
							onClick={run("copy")}
							class="min-h-11 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
						>
							リンクをコピー
						</button>
						<button
							type="button"
							disabled={isPending}
							onClick={run("sync")}
							class="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
						>
							{pendingAction === "sync" ? "同期中…" : "今すぐ同期"}
						</button>
						<button
							type="button"
							disabled={isPending}
							onClick={run("disconnect")}
							class="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
						>
							この端末の同期を解除
						</button>
						<button
							type="button"
							disabled={isPending}
							onClick={run("delete")}
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
					onClick={run("create")}
					class="mt-4 min-h-11 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
				>
					{pendingAction === "create" ? "作成中…" : "同期リンクを作る"}
				</button>
			)}
			{feedback && (
				<p
					role={feedback.kind === "error" ? "alert" : "status"}
					class={`mt-4 rounded-lg border bg-white px-4 py-3 text-sm ${feedback.kind === "error" ? "border-red-200 text-red-700" : "border-slate-200 text-gray-700"}`}
				>
					{feedback.message}
				</p>
			)}
		</div>
	);
}
