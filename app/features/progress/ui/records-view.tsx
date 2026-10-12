import type { Handle } from "remix/component";
import { clientEntry, css, on } from "remix/component";
import type { SyncKey } from "../../../types/index.ts";
import { formatAccuracy, formatDuration, summarizeChallenge } from "../../challenge/challenge.ts";
import { syncChallenges } from "../../challenge/challengeApi.ts";
import { readChallengeHistory } from "../../challenge/challengeStorage.ts";
import type { ChallengeSnapshot, CompletedChallengePayload } from "../../challenge/types.ts";
import { createSyncLink, deleteRemoteProgress, syncProgress } from "../progressApi.ts";
import {
	mergeStoredProgress,
	readProgress,
	readSyncKey,
	removeSyncKey,
	saveSyncKey,
} from "../progressStorage.ts";

const recordsSectionStyle = css({
	marginTop: "1.5rem",
	padding: "1rem 1.25rem",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-card)",
	"& h2": { marginTop: 0, fontSize: "1.05rem", color: "var(--color-primary)" },
	"& ul": { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.25rem" },
	"& li": { display: "flex", justifyContent: "space-between", gap: "0.75rem" },
});

const recordsActionsStyle = css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" });

const recordsStatusStyle = css({
	marginTop: "0.5rem",
	fontSize: "0.85rem",
	color: "var(--color-text-muted)",
});

type Status = Readonly<{ kind: "idle" | "busy" | "ok" | "error"; message: string }>;

/**
 * 学習記録ページ（clientEntry）。
 * 端末内の進捗・小テスト履歴の表示と、秘密リンクによる同期の管理を担当する。
 */
export const RecordsView = clientEntry(
	"/assets/client.js#RecordsView",
	function RecordsViewEntry(handle: Handle<{ currentPath: string }>) {
		const read = () => {
			const progress = Object.values(readProgress()).toSorted(
				(left, right) => right.updatedAt - left.updatedAt,
			);
			const challenges = readChallengeHistory();
			return { progress, challenges };
		};

		let status: Status = { kind: "idle", message: "" };
		let view = read();

		const refresh = () => {
			view = read();
		};

		const runSync = async () => {
			const key = readSyncKey();
			if (!key) {
				return;
			}
			status = { kind: "busy", message: "同期中…" };
			await handle.update();

			const progressResult = await syncProgress(key, view.progress);
			if (progressResult.isErr()) {
				status = { kind: "error", message: "進捗を同期できませんでした" };
				await handle.update();
				return;
			}
			mergeStoredProgress(progressResult.value);

			const completed = view.challenges.filter((snapshot) => snapshot.status === "completed");
			const challengeResult = await syncChallenges(
				key,
				completed
					.map((snapshot) => snapshotToPayload(snapshot))
					.filter((payload) => payload !== null),
			);
			status = challengeResult.isErr()
				? { kind: "error", message: "小テスト結果を同期できませんでした" }
				: { kind: "ok", message: "同期しました" };
			refresh();
			await handle.update();
		};

		const createLink = async () => {
			status = { kind: "busy", message: "リンクを作成中…" };
			await handle.update();
			const response = await createSyncLink();
			if (!response.ok) {
				status = { kind: "error", message: "リンクを作成できませんでした" };
				await handle.update();
				return;
			}
			const body = (await response.json()) as { key?: unknown };
			if (typeof body.key !== "string") {
				status = { kind: "error", message: "リンクの形式が正しくありません" };
				await handle.update();
				return;
			}
			const result = saveSyncKey(body.key as SyncKey);
			status =
				result.kind === "StorageMutationSuccess"
					? { kind: "ok", message: "この端末に同期リンクを保存しました" }
					: { kind: "error", message: "保存できませんでした" };
			await handle.update();
		};

		const removeLink = async () => {
			const key = readSyncKey();
			if (key) {
				await deleteRemoteProgress(key);
			}
			removeSyncKey();
			status = { kind: "ok", message: "同期リンクを削除しました" };
			await handle.update();
		};

		const copyLink = async () => {
			const key = readSyncKey();
			if (key && typeof navigator !== "undefined") {
				await navigator.clipboard.writeText(key);
				status = { kind: "ok", message: "同期リンクをコピーしました" };
				await handle.update();
			}
		};

		return () => {
			const syncKey = readSyncKey();

			return (
				<section>
					<header mix={recordsSectionStyle}>
						<h2>同期</h2>
						{syncKey ? (
							<>
								<p>
									この端末は同期リンクで保護されています。リンクを知っている端末だけが記録を共有できます。
								</p>
								<div mix={recordsActionsStyle}>
									<button type="button" mix={on("click", copyLink)}>
										リンクをコピー
									</button>
									<button type="button" mix={on("click", runSync)}>
										いま同期する
									</button>
									<button type="button" mix={on("click", removeLink)}>
										同期を解除
									</button>
								</div>
							</>
						) : (
							<>
								<p>同期を使うと、別の端末と同じ学習記録を共有できます。</p>
								<button type="button" mix={on("click", createLink)}>
									同期リンクを作成
								</button>
							</>
						)}
						{status.message ? (
							<p role="status" mix={recordsStatusStyle}>
								{status.message}
							</p>
						) : null}
					</header>

					<section mix={recordsSectionStyle}>
						<h2>答えを確認した問題（{view.progress.length}）</h2>
						{view.progress.length === 0 ? (
							<p>まだ記録はありません。</p>
						) : (
							<ul>
								{view.progress.slice(0, 50).map((entry) => (
									<li key={entry.questionId}>
										<a href={`/records#${entry.questionId}`}>{entry.questionId}</a>
										<span>{formatDuration(entry.updatedAt - entry.createdAt)}</span>
									</li>
								))}
							</ul>
						)}
					</section>

					<section mix={recordsSectionStyle}>
						<h2>小テストの結果（{view.challenges.length}）</h2>
						{view.challenges.length === 0 ? (
							<p>まだ結果はありません。</p>
						) : (
							<ul>
								{view.challenges.slice(0, 20).map((snapshot) => {
									const payload = snapshotToPayload(snapshot);
									if (!payload) {
										return null;
									}
									const summary = summarizeChallenge(payload);
									return (
										<li key={payload.challengeId}>
											<span>{payload.examId}</span>
											<span>{formatAccuracy(summary.accuracy)}</span>
											<span>
												{summary.correctCount} / {summary.correctCount + summary.incorrectCount}
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</section>
				</section>
			);
		};
	},
);

function snapshotToPayload(snapshot: ChallengeSnapshot): CompletedChallengePayload | null {
	if (snapshot.status !== "completed" || snapshot.updatedAt === null) {
		return null;
	}
	return {
		challengeId: snapshot.challengeId,
		examId: snapshot.examId,
		createdAt: snapshot.createdAt,
		updatedAt: snapshot.updatedAt,
		answers: snapshot.questionIds.flatMap((questionId) => {
			const judgment = snapshot.judgments[questionId];
			if (!judgment) {
				return [];
			}
			return [
				{
					questionId,
					elapsedMs: snapshot.questionElapsedMs[questionId] ?? 0,
					judgment,
					createdAt: snapshot.answerCreatedAt[questionId] ?? snapshot.createdAt,
					updatedAt: snapshot.updatedAt as number,
				},
			];
		}),
	} as never;
}
