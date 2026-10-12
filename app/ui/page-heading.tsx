import type { Handle } from "remix/component";
import { css } from "remix/component";

const headingStyle = css({
	margin: "0 0 1.25rem",
});

const eyebrowStyle = css({
	margin: "0 0 0.25rem",
	fontSize: "0.8rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: "var(--color-text-muted)",
});

const titleStyle = css({
	fontFamily: "var(--font-serif)",
	fontSize: "1.6rem",
	fontWeight: 700,
	color: "var(--color-primary)",
	margin: 0,
});

const descriptionStyle = css({
	margin: "0.5rem 0 0",
	color: "var(--color-text-muted)",
});

export function PageHeading(
	handle: Handle<{ title: string; description?: string; eyebrow?: string }>,
) {
	return () => (
		<header mix={headingStyle}>
			{handle.props.eyebrow ? <p mix={eyebrowStyle}>{handle.props.eyebrow}</p> : null}
			<h1 mix={titleStyle}>{handle.props.title}</h1>
			{handle.props.description ? <p mix={descriptionStyle}>{handle.props.description}</p> : null}
		</header>
	);
}
