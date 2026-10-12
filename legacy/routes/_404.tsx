/** @jsxImportSource hono/jsx */
import type { NotFoundHandler } from "hono";
import { NotFoundPage } from "../components/NotFoundPage";

// 404 ページ（HonoX の _404.tsx + NotFoundHandler 規約）。
const handler: NotFoundHandler = (c) =>
	c.render(<NotFoundPage />, {
		title: "ページが見つかりません - 基本情報技術 I",
		noindex: true,
		noCanonical: true,
	});

export default handler;
