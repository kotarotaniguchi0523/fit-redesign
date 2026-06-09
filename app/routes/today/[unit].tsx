/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../../components/Header";
import { unitBasedTabs } from "../../data/units";
import { getUnitQuestions } from "../../features/srs/questionManifest";
import DailySession from "../../features/study/$DailySession";

/**
 * 今日の道（SRS デイリーセッション）。
 *
 * DailySession island が出題キュー・進捗・サマリ・表示カードを所有する。
 * noindex。
 */

export default createRoute(async (c) => {
	const unitId = c.req.param("unit");
	const unit = unitBasedTabs.find((tab) => tab.id === unitId);

	if (!unit) {
		return c.notFound();
	}

	const unitNumber = unitBasedTabs.findIndex((tab) => tab.id === unit.id) + 1;
	const questions = await getUnitQuestions(unit);

	const pageTitle = `今日の道: ${unit.name} - 基本情報技術 I`;
	const pageDescription = `${unit.name}の今日の演習。間隔反復で「忘れた頃の復習」と新しい問題を少しずつ。`;

	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	return c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="today-shell">
				<div class="mx-auto max-w-3xl px-4 py-6">
					<a href="/" class="today-back">
						← ホームに戻る
					</a>
					<DailySession
						unitId={unit.id}
						unitName={unit.name}
						unitNumber={unitNumber}
						questions={questions}
					/>
				</div>
			</main>
		</>,
		{
			title: pageTitle,
			description: pageDescription,
			noindex: true,
		},
	);
});
