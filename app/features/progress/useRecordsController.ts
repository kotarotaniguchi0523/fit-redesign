import { useEffect, useRef, useState, useSyncExternalStore } from "hono/jsx";
import type { ProgressEntry } from "./progress";
import { latestProgress } from "./progress";
import { syncProgress, syncProgressErrorMessage } from "./progressApi";
import {
	parseProgressSnapshot,
	readProgress,
	readProgressSnapshot,
	readSyncKey,
	removeSyncKey,
	saveProgressEntries,
	saveSyncKey,
	subscribeToProgress,
	subscribeToSyncKey,
} from "./progressStorage";

type PendingAction = "create" | "sync" | "delete";
export type RecordsFeedback = Readonly<{
	kind: "success" | "error";
	message: string;
}>;

type RecordsController = Readonly<{
	entries: readonly ProgressEntry[];
	latest: ProgressEntry | undefined;
	shareUrl: string;
	isConnected: boolean;
	feedback: RecordsFeedback | null;
	pendingAction: PendingAction | null;
	isPending: boolean;
	createLink: () => void;
	copyLink: () => Promise<void>;
	disconnect: () => void;
	deleteLink: () => void;
	syncNow: () => void;
}>;

export function useRecordsController(origin: string): RecordsController {
	const [feedback, setFeedback] = useState<RecordsFeedback | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const isMounted = useRef(true);
	const progressSnapshot = useSyncExternalStore(
		subscribeToProgress,
		readProgressSnapshot,
		() => null,
	);
	const syncKey = useSyncExternalStore(subscribeToSyncKey, readSyncKey, () => null);
	const entries = Object.values(parseProgressSnapshot(progressSnapshot)).sort(
		(a, b) => b.revealedAt - a.revealedAt,
	);
	const updateView = (update: () => void): void => {
		if (isMounted.current) {
			update();
		}
	};

	const runAction = (
		action: PendingAction,
		task: () => Promise<void>,
		fallbackMessage: string,
	): void => {
		(async (): Promise<void> => {
			updateView(() => {
				setPendingAction(action);
				setFeedback(null);
			});
			try {
				await task();
			} catch (error) {
				updateView(() => {
					setFeedback({
						kind: "error",
						message: error instanceof Error ? error.message : fallbackMessage,
					});
				});
			} finally {
				updateView(() => setPendingAction(null));
			}
		})().catch(() => undefined);
	};

	const applySync = (key: string, local: readonly ProgressEntry[]): Promise<void> =>
		syncProgress(key, local).match(
			(merged) => {
				saveProgressEntries(merged);
				updateView(() => {
					setFeedback({ kind: "success", message: "この端末と同期しました" });
				});
			},
			(error) => {
				throw new Error(syncProgressErrorMessage(error));
			},
		);

	useEffect(() => {
		isMounted.current = true;
		const cleanup = (): void => {
			isMounted.current = false;
		};
		const local = Object.values(readProgress()).sort((a, b) => b.revealedAt - a.revealedAt);
		const incomingKey = new URLSearchParams(location.hash.slice(1)).get("sync");
		if (location.hash) {
			history.replaceState(null, "", `${location.pathname}${location.search}`);
		}

		const storedKey = readSyncKey();
		if (!incomingKey) {
			if (storedKey) {
				runAction("sync", () => applySync(storedKey, local), "同期できませんでした");
			}
			return cleanup;
		}
		if (!window.confirm("この同期リンクの記録を、この端末の記録と統合しますか？")) {
			return cleanup;
		}
		runAction(
			"sync",
			async (): Promise<void> => {
				await applySync(incomingKey, local);
				saveSyncKey(incomingKey);
			},
			"同期できませんでした",
		);
		return cleanup;
	}, []);

	const shareUrl = syncKey ? `${origin}/records#sync=${syncKey}` : "";
	const disconnect = (): void => {
		removeSyncKey();
		updateView(() => {
			setFeedback({ kind: "success", message: "同期を解除しました。端末内の記録は残っています" });
		});
	};

	return {
		entries,
		latest: latestProgress(entries),
		shareUrl,
		isConnected: syncKey !== null,
		feedback,
		pendingAction,
		isPending: pendingAction !== null,
		createLink: (): void => {
			runAction(
				"create",
				async (): Promise<void> => {
					const response = await fetch("/progress/spaces", { method: "POST" });
					if (!response.ok) {
						throw new Error("同期リンクを作成できませんでした");
					}
					const body = (await response.json()) as { key: string };
					await applySync(body.key, entries);
					saveSyncKey(body.key);
				},
				"同期リンクを作成できませんでした",
			);
		},
		copyLink: async (): Promise<void> => {
			try {
				await navigator.clipboard.writeText(shareUrl);
				setFeedback({ kind: "success", message: "同期リンクをコピーしました" });
			} catch {
				setFeedback({
					kind: "error",
					message: "コピーできませんでした。下のリンクを選択してコピーしてください",
				});
			}
		},
		disconnect,
		deleteLink: (): void => {
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
					updateView(() => {
						setFeedback({
							kind: "success",
							message: "同期先を削除しました。端末内の記録は残っています",
						});
					});
				},
				"同期先を削除できませんでした",
			);
		},
		syncNow: (): void => {
			if (syncKey) {
				runAction("sync", () => applySync(syncKey, entries), "同期できませんでした");
			}
		},
	};
}
