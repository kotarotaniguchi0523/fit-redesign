/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { NotFoundPage } from "../components/NotFoundPage";

// This route is rendered only during SSG to create Cloudflare's 404 document.
export default createRoute((c) =>
	c.render(<NotFoundPage />, {
		title: "ページが見つかりません - 基本情報技術 I",
		noindex: true,
		noCanonical: true,
	}),
);
