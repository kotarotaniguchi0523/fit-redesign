import type { Handle } from "remix/component";
import { css } from "remix/component";

import { slideOnlyUnits } from "../data/units.ts";
import { PageHeading } from "../ui/page-heading.tsx";
import { Document } from "./document.tsx";

const mainStyle = css({ maxWidth: "52rem", margin: "0 auto", padding: "1rem 1rem 4rem" });

const panelStyle = css({
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "0.75rem",
	padding: "1rem 1.25rem",
	marginTop: "1.25rem",
});

const sectionTitleStyle = css({
	fontSize: "1.05rem",
	fontWeight: 700,
	color: "var(--color-primary)",
	margin: "0 0 0.5rem",
});

const linkStyle = css({
	color: "var(--color-primary)",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

/** 講義資料のみの単元（PDF は明治大学の公開ページを外部参照）。 */
export function SlideOnlyPage(handle: Handle<{ currentPath: string }>) {
	return () => (
		<Document
			title="講義資料 - 基本情報技術 I"
			description="講義スライドをPDFで確認できます。"
			currentPath={handle.props.currentPath}
		>
			<main id="main-content" mix={mainStyle}>
				<PageHeading
					eyebrow="資料"
					title="講義資料"
					description="講義スライドをPDFで確認できます。"
				/>
				{slideOnlyUnits.map((unit) => (
					<section key={unit.id} mix={panelStyle}>
						<h2 mix={sectionTitleStyle}>{unit.name}</h2>
						<ul>
							{unit.slides.map((slide) => (
								<li key={slide.id}>
									<a mix={linkStyle} href={slide.pdfPath} target="_blank" rel="noreferrer noopener">
										{slide.title}（PDF）
									</a>
								</li>
							))}
						</ul>
					</section>
				))}
			</main>
		</Document>
	);
}
