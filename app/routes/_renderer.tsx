import { jsxRenderer } from "hono/jsx-renderer";

export default jsxRenderer(({ children, title }) => (
	<html lang="ja">
		<head>
			<meta charSet="UTF-8" />
			<title>{title}</title>
		</head>
		<body>{children}</body>
	</html>
));
