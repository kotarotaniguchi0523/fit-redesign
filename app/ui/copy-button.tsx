import type { Handle } from "remix/component";
import { clientEntry, css, on } from "remix/component";

const FADE_MS = 160;
const HOLD_MS = 1200;

type CopyState = "idle" | "copied" | "failed";

const buttonStyle = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "0.375rem",
	padding: "0.375rem 0.75rem",
	border: "1px solid var(--color-border)",
	borderRadius: "0.375rem",
	background: "var(--color-bg-card)",
	color: "var(--color-primary)",
	font: "inherit",
	fontSize: "0.85rem",
	cursor: "pointer",
	"&:hover": { background: "var(--color-primary-soft)" },
});

/** Markdown テキストをクリップボードへコピーする clientEntry。 */
export const CopyButton = clientEntry(
	"/assets/client.js#CopyButton",
	function CopyButtonEntry(handle: Handle<{ text: string; label?: string }>) {
		let state: CopyState = "idle";

		return () => {
			const label =
				state === "copied"
					? "コピーしました"
					: state === "failed"
						? "コピー失敗"
						: (handle.props.label ?? "Markdownをコピー");

			return (
				<button
					type="button"
					mix={[
						buttonStyle,
						on("click", async () => {
							try {
								await navigator.clipboard.writeText(handle.props.text);
								state = "copied";
							} catch {
								state = "failed";
							}
							await handle.update();
							await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
							state = "idle";
							await handle.update();
						}),
					]}
					style={{ transition: `opacity ${FADE_MS}ms ease` }}
				>
					{label}
				</button>
			);
		};
	},
);
