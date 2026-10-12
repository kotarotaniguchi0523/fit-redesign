import type { Handle } from "remix/component";
import { css, on } from "remix/component";

import { MenuIcon } from "../../../ui/icons.tsx";
import type { PlayerQuestion } from "../player/types.ts";

const headerStyle = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	flexWrap: "wrap",
	gap: "0.75rem",
	padding: "0.75rem 1rem",
	background: "var(--color-bg-card)",
	borderBottom: "1px solid var(--color-border)",
});

const identityStyle = css({
	display: "flex",
	alignItems: "center",
	gap: "0.5rem",
	minWidth: 0,
	"& h2": {
		margin: 0,
		fontFamily: "var(--font-serif)",
		fontSize: "1.05rem",
		fontWeight: 700,
		color: "var(--color-primary)",
	},
});

const progressStyle = css({ flex: "1 1 16rem", minWidth: 0 });

const stepsStyle = css({
	display: "flex",
	alignItems: "center",
	gap: "0.75rem",
	"& ol": {
		display: "flex",
		flexWrap: "wrap",
		gap: "0.25rem",
		listStyle: "none",
		margin: 0,
		padding: 0,
	},
});

const stepButtonStyle = css({
	width: "1.75rem",
	height: "1.75rem",
	border: "1px solid var(--color-border)",
	borderRadius: "999px",
	background: "var(--color-bg)",
	color: "var(--color-text-muted)",
	font: "inherit",
	fontSize: "0.8rem",
	cursor: "pointer",
	'&[aria-current="step"]': {
		background: "var(--color-primary)",
		borderColor: "var(--color-primary)",
		color: "#fff",
		fontWeight: 700,
	},
	"&:disabled": { cursor: "default", opacity: 0.6 },
});

const trackStyle = css({
	flex: 1,
	height: "0.375rem",
	borderRadius: "999px",
	background: "var(--color-primary-soft)",
	overflow: "hidden",
	"& > span": {
		display: "block",
		height: "100%",
		background: "var(--color-accent)",
		transition: "width 150ms ease",
	},
});

/**
 * プレイヤーのヘッダー。現在の問題は `aria-current="step"` で示す
 * ステップ表示（tabs ではない: 各タブに対応する panel を持たないため）。
 */
export function PlayerHeader(
	handle: Handle<{
		playerTitle: string;
		questions: readonly PlayerQuestion[];
		currentQuestionIndex: number;
		onOpenQuestionList: () => void;
		onSelectQuestion: (index: number) => void;
		disabled?: boolean;
	}>,
) {
	return () => {
		const {
			playerTitle,
			questions,
			currentQuestionIndex,
			onOpenQuestionList,
			onSelectQuestion,
			disabled = false,
		} = handle.props;
		const ratio = questions.length > 0 ? (currentQuestionIndex + 1) / questions.length : 0;

		return (
			<header mix={headerStyle}>
				<div mix={identityStyle}>
					{questions.length > 1 ? (
						<button
							type="button"
							mix={on("click", onOpenQuestionList)}
							aria-label="問題一覧を開く"
							title="問題一覧を開く"
							disabled={disabled}
						>
							<MenuIcon />
						</button>
					) : null}
					<h2>{playerTitle}</h2>
				</div>
				<nav aria-label="問題番号" mix={progressStyle}>
					<div mix={stepsStyle}>
						<ol>
							{questions.map((question, index) => (
								<li key={question.id}>
									<button
										type="button"
										aria-label={`問${index + 1}`}
										aria-current={index === currentQuestionIndex ? "step" : undefined}
										mix={[stepButtonStyle, on("click", () => onSelectQuestion(index))]}
										disabled={disabled}
									>
										{index + 1}
									</button>
								</li>
							))}
						</ol>
						<div
							mix={trackStyle}
							role="progressbar"
							aria-label="問題の進捗"
							aria-valuemin={0}
							aria-valuemax={questions.length}
							aria-valuenow={currentQuestionIndex + 1}
							aria-valuetext={`問${currentQuestionIndex + 1} / ${questions.length}`}
						>
							<span style={{ width: `${ratio * 100}%` }} />
						</div>
					</div>
				</nav>
			</header>
		);
	};
}
