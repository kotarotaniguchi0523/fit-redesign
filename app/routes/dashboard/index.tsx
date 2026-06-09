/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../../components/Header";
import DashboardEntry from "../../features/dashboard/$DashboardEntry";

export default createRoute((c) =>
	c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="mx-auto max-w-2xl px-4 py-16 text-center">
					<DashboardEntry />
				</div>
			</main>
		</>,
		{ title: "学習ダッシュボード - 基本情報技術 I", noindex: true },
	),
);
