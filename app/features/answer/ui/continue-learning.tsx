import type { Handle } from "remix/component";
import { clientEntry, css, on } from "remix/component";

import { readProgress } from "../../progress/progressStorage.ts";

type LocationGroup = Readonly<{
	unitName: string;
	year: string;
	hrefPrefix: string;
	questionIds: readonly string[];
}>;

const sectionStyle = css({
	marginTop: "2rem",
	padding: "1rem 1.25rem",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "0.75rem",
});

const linkStyle = css({
	color: "var(--color-primary)",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

/**
 * 「前回の続き」導線（clientEntry）。
 * 端末内の進捗から、直近で確認した問題をその単元・年度へのリンクとして提示する。
 */
export const ContinueLearning = clientEntry(
	"/assets/client.js#ContinueLearning",
	function ContinueLearningEntry(handle: Handle<{ groups: readonly LocationGroup[] }>) {
		let expanded = false;

		const recent = () => {
			const entries = Object.values(readProgress()).toSorted(
				(left, right) => right.updatedAt - left.updatedAt,
			);
			const byQuestion = new Map(entries.map((entry) => [entry.questionId, entry]));
			const items: Array<{ questionId: string; href: string; unitName: string; year: string }> = [];
			for (const group of handle.props.groups) {
				for (const questionId of group.questionIds) {
					if (byQuestion.has(questionId as never)) {
						items.push({
							questionId,
							href: `${group.hrefPrefix}${questionId}`,
							unitName: group.unitName,
							year: group.year,
						});
					}
				}
			}
			return items;
		};

		return () => {
			const items = recent();
			if (items.length === 0) {
				return null;
			}
			const visible = expanded ? items : items.slice(0, 5);

			return (
				<section mix={sectionStyle} aria-labelledby="continue-learning-title">
					<h2 id="continue-learning-title">前回の続き</h2>
					<ul class="continue-learning__list">
						{visible.map((item) => (
							<li key={item.questionId}>
								<a mix={linkStyle} href={item.href}>
									{item.unitName} {item.year}年度 — {item.questionId}
								</a>
							</li>
						))}
					</ul>
					{items.length > visible.length || expanded ? (
						<button
							type="button"
							class="exam-footer-button exam-footer-button--quiet"
							mix={on("click", () => {
								expanded = !expanded;
								void handle.update();
							})}
						>
							{expanded ? "閉じる" : "もっと見る"}
						</button>
					) : null}
				</section>
			);
		};
	},
);
