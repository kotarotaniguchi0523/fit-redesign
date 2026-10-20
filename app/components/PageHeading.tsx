import type { JSX } from "hono/jsx/jsx-runtime";

interface PageHeadingProps {
	title: string;
	description?: string;
	eyebrow?: string;
}

export function PageHeading({ title, description, eyebrow }: PageHeadingProps): JSX.Element {
	return (
		<header class="page-heading">
			{eyebrow ? <p class="page-heading__eyebrow">{eyebrow}</p> : null}
			<h1>{title}</h1>
			{description ? <p class="page-heading__description">{description}</p> : null}
		</header>
	);
}
