import { animateEntrance, animateExit, spring } from "@remix-run/ui/animation";
import * as popover from "@remix-run/ui/popover";
import type { Handle } from "remix/component";
import { css, on } from "remix/component";
import type { QuestionId } from "../../../../types/index.ts";
import { formatDuration } from "../../challenge.ts";
import type { ChallengeState } from "../../types.ts";
import type { PlayerMode, PlayerQuestion } from "../types.ts";
import { CloseIcon } from "./icons.tsx";

const panelStyle = css({
	position: "fixed",
	top: 0,
	right: 0,
	bottom: 0,
	width: "min(22rem, 90vw)",
	overflowY: "auto",
	background: "var(--color-bg-card)",
	borderLeft: "1px solid var(--color-border)",
	boxShadow: "var(--shadow-card)",
	padding: "1rem",
	zIndex: 60,
});

const toolbarStyle = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "0.5rem",
	marginBottom: "0.75rem",
	"& h2": {
		margin: 0,
		fontSize: "1rem",
		fontFamily: "var(--font-serif)",
		color: "var(--color-primary)",
	},
});

const listStyle = css({
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "grid",
	gap: "0.25rem",
});

const itemStyle = css({
	display: "grid",
	gridTemplateColumns: "auto auto 1fr",
	alignItems: "center",
	gap: "0.5rem",
	width: "100%",
	padding: "0.5rem 0.625rem",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-control)",
	background: "var(--color-bg-card)",
	textAlign: "left",
	font: "inherit",
	cursor: "pointer",
	"&:hover": { background: "var(--color-primary-soft)" },
});

const currentItemStyle = css({
	borderColor: "var(--color-primary)",
	background: "var(--color-primary-soft)",
});

const promptStyle = css({
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	color: "var(--color-text-muted)",
	fontSize: "0.85rem",
});

/**
 * 問題一覧。`@remix-run/ui/popover` の anchor/surface と
 * `@remix-run/ui/animation` の進入・退出を `mix` で借りる。
 */
export function PlayerList(
	handle: Handle<{
		state: ChallengeState;
		questions: readonly PlayerQuestion[];
		mode: PlayerMode;
		open: boolean;
		onSelect: (index: number) => void;
		onClose: () => void;
	}>,
) {
	return () => {
		const { state, questions, mode, open, onSelect, onClose } = handle.props;
		if (!open) {
			return null;
		}

		const currentQuestionId = state.questionIds[state.currentIndex] as QuestionId | undefined;
		const listedQuestions =
			mode === "question"
				? questions
				: state.questionIds
						.map((questionId) => questions.find((item) => item.id === questionId))
						.filter((question): question is PlayerQuestion => question !== undefined);

		return (
			<popover.Context>
				<aside
					aria-label="問題一覧"
					mix={[
						panelStyle,
						animateEntrance({ opacity: 0, x: 24, ...spring("snappy") }),
						animateExit({ opacity: 0, x: 24, ...spring("snappy") }),
						popover.surface({ open, onHide: onClose }),
					]}
				>
					<div mix={toolbarStyle}>
						<h2>問題一覧</h2>
						<button type="button" mix={on("click", onClose)} aria-label="問題一覧を閉じる">
							<CloseIcon />
						</button>
					</div>
					<ol mix={listStyle}>
						{listedQuestions.map((question, index) => {
							const judgment = state.judgments[question.id];
							const isCurrent = question.id === currentQuestionId;
							return (
								<li key={question.id}>
									<button
										type="button"
										mix={[
											itemStyle,
											isCurrent ? currentItemStyle : null,
											on("click", () => onSelect(index)),
										]}
										aria-current={isCurrent ? "true" : undefined}
									>
										<span>問{question.number ?? index + 1}</span>
										{mode === "exam" ? (
											<span>{formatDuration(state.questionElapsedMs[question.id] ?? 0)}</span>
										) : null}
										{judgment ? <span>{judgment === "correct" ? "○" : "×"}</span> : <span />}
										<span mix={promptStyle}>{question.text}</span>
									</button>
								</li>
							);
						})}
					</ol>
				</aside>
			</popover.Context>
		);
	};
}
