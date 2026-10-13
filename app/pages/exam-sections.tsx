import type { Handle } from "remix/component";
import { css } from "remix/component";

import { routes } from "../routes.ts";

export type ExamSection = {
	examNumber: number;
	title: string;
	questions: ReadonlyArray<{ id: string; number: number; text: string }>;
};

const sectionStyle = css({
	marginTop: "1.5rem",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-card)",
	padding: "1rem 1.25rem",
});

const titleStyle = css({
	fontSize: "1.05rem",
	fontWeight: 700,
	color: "var(--color-primary)",
	margin: "0 0 0.5rem",
});

const listStyle = css({
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "grid",
	gap: "0.25rem",
});

const linkStyle = css({
	color: "var(--color-primary)",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

/**
 * 単元・年度の小テスト一覧（ルート所有の領域）。
 * `/:unit/:year` のページと、その `<Frame>` ソース（region ルート）の両方から使う。
 */
export function ExamSections(
	handle: Handle<{ unitId: string; year: string; sections: readonly ExamSection[] }>,
) {
	return () => {
		const { unitId, year, sections } = handle.props;
		return (
			<>
				{sections.map((section) => (
					<section key={section.examNumber} mix={sectionStyle}>
						<h2 mix={titleStyle}>
							小テスト{section.examNumber}: {section.title}
						</h2>
						<ul mix={listStyle}>
							{section.questions.map((question) => (
								<li key={question.id}>
									<a
										mix={linkStyle}
										href={routes.question.href({
											unit: unitId,
											year,
											exam: String(section.examNumber),
											question: question.id,
										})}
									>
										問{question.number}
									</a>
								</li>
							))}
						</ul>
					</section>
				))}
			</>
		);
	};
}
