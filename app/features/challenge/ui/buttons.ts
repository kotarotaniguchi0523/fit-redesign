import { css } from "remix/component";

/** プレイヤー/結果画面で共有するボタン見た目。 */
export const primaryButtonStyle = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "0.625rem 1.25rem",
	borderRadius: "var(--radius-control)",
	border: "1px solid var(--color-primary)",
	background: "var(--color-primary)",
	color: "#fff",
	font: "inherit",
	textDecoration: "none",
	cursor: "pointer",
});

export const quietButtonStyle = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "0.625rem 1.25rem",
	borderRadius: "var(--radius-control)",
	border: "1px solid var(--color-border)",
	background: "var(--color-bg-card)",
	color: "var(--color-primary)",
	font: "inherit",
	textDecoration: "none",
	cursor: "pointer",
});
