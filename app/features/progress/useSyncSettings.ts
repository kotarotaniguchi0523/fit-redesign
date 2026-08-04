import { useEffect, useRef, useState, useSyncExternalStore } from "hono/jsx";
import { type ProgressEntry, type SyncKey, SyncKeySchema } from "../../types/browser";
import {
	createSyncSpace,
	deleteRemoteProgress,
	syncProgress,
	syncProgressErrorMessage,
} from "./progressApi";
import {
	readProgress,
	readSyncKey,
	removeSyncKey,
	saveProgressEntries,
	saveSyncKey,
	subscribeToSyncKey,
} from "./progressStorage";

export type SyncCommand = "create" | "copy" | "disconnect" | "delete" | "sync";
type PendingAction = Exclude<SyncCommand, "copy" | "disconnect">;
export type SyncFeedback = Readonly<{ kind: "success" | "error"; message: string }>;

type SyncSettings = Readonly<{
	shareUrl: string;
	feedback: SyncFeedback | null;
	pendingAction: PendingAction | null;
	isConnected: boolean;
	execute: (command: SyncCommand) => void;
}>;

export function useSyncSettings(origin: string): SyncSettings {
	const [feedback, setFeedback] = useState<SyncFeedback | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const mounted = useRef(true);
	const syncKey = useSyncExternalStore(subscribeToSyncKey, readSyncKey, () => null);
	const update = (operation: () => void): void => {
		if (mounted.current) {
			operation();
		}
	};
	const localEntries = (): readonly ProgressEntry[] =>
		Object.values(readProgress()).sort((a, b) => b.revealedAt - a.revealedAt);
	const persistSyncKey = (key: SyncKey): void => {
		if (saveSyncKey(key).kind === "StorageMutationError") {
			throw new Error("同期設定をこの端末へ保存できませんでした");
		}
	};
	const applySync = (key: SyncKey): Promise<void> =>
		syncProgress(key, localEntries()).match(
			(merged) => {
				saveProgressEntries(merged);
				update(() => setFeedback({ kind: "success", message: "この端末と同期しました" }));
			},
			(error) => {
				throw new Error(syncProgressErrorMessage(error));
			},
		);
	const run = (action: PendingAction, task: () => Promise<void>, fallback: string): void => {
		update(() => {
			setPendingAction(action);
			setFeedback(null);
		});
		task()
			.catch((error: unknown) =>
				update(() =>
					setFeedback({
						kind: "error",
						message: error instanceof Error ? error.message : fallback,
					}),
				),
			)
			.finally(() => update(() => setPendingAction(null)))
			.catch(() => undefined);
	};

	useEffect(() => {
		mounted.current = true;
		const cleanup = (): void => {
			mounted.current = false;
		};
		const rawIncomingKey = new URLSearchParams(location.hash.slice(1)).get("sync");
		const incomingKey = SyncKeySchema.safeParse(rawIncomingKey);
		if (location.hash) {
			history.replaceState(null, "", `${location.pathname}${location.search}`);
		}
		if (rawIncomingKey !== null && !incomingKey.success) {
			setFeedback({ kind: "error", message: "同期リンクが無効です" });
			return cleanup;
		}
		const key = incomingKey.success ? incomingKey.data : readSyncKey();
		if (
			key &&
			(!incomingKey.success ||
				window.confirm("この同期リンクの記録を、この端末の記録と統合しますか？"))
		) {
			run(
				"sync",
				async () => {
					await applySync(key);
					if (incomingKey.success) {
						persistSyncKey(incomingKey.data);
					}
				},
				"同期できませんでした",
			);
		}
		return cleanup;
	}, []);

	const disconnect = (message = "同期を解除しました。端末内の記録は残っています"): void => {
		if (removeSyncKey().kind === "StorageMutationError") {
			update(() => setFeedback({ kind: "error", message: "同期設定を変更できませんでした" }));
			return;
		}
		update(() => setFeedback({ kind: "success", message }));
	};
	const execute = (command: SyncCommand): void => {
		switch (command) {
			case "create":
				run(
					"create",
					async () => {
						const response = await createSyncSpace();
						if (!response.ok) {
							throw new Error("同期リンクを作成できませんでした");
						}
						const body = await response.json();
						await applySync(body.key);
						persistSyncKey(body.key);
					},
					"同期リンクを作成できませんでした",
				);
				return;
			case "copy":
				navigator.clipboard.writeText(syncKey ? `${origin}/records#sync=${syncKey}` : "").then(
					() =>
						update(() => setFeedback({ kind: "success", message: "同期リンクをコピーしました" })),
					() =>
						update(() =>
							setFeedback({
								kind: "error",
								message: "コピーできませんでした。下のリンクを選択してコピーしてください",
							}),
						),
				);
				return;
			case "disconnect":
				disconnect();
				return;
			case "delete":
				if (
					!(syncKey && window.confirm("同期先の記録を削除しますか？ この端末の記録は残ります。"))
				) {
					return;
				}
				run(
					"delete",
					async () => {
						const response = await deleteRemoteProgress(syncKey);
						if (!response.ok) {
							throw new Error("同期先を削除できませんでした");
						}
						disconnect("同期先を削除しました。端末内の記録は残っています");
					},
					"同期先を削除できませんでした",
				);
				return;
			case "sync":
				if (syncKey) {
					run("sync", () => applySync(syncKey), "同期できませんでした");
				}
				return;
			default:
				command satisfies never;
		}
	};

	return {
		shareUrl: syncKey ? `${origin}/records#sync=${syncKey}` : "",
		feedback,
		pendingAction,
		isConnected: syncKey !== null,
		execute,
	};
}
