/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../../components/Header";
import { QuestionCard } from "../../components/QuestionCard";
import { unitBasedTabs } from "../../data/units";
import { getUnitQuestions } from "../../features/srs/questionManifest";

/**
 * 今日の道（SRS デイリーセッション）。
 *
 * 命令的な daily-session ロジックは client script（app/client.ts が配線）が引き継ぐため、
 * このルートは描画済み DOM（data-daily-session / data-cards / data-progress-bar 等の
 * フック属性付き要素と、各問題の QuestionCard）を出力するだけにする。
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

					<div data-daily-session data-unit-id={unit.id} data-unit-name={unit.name}>
						<header data-session-header class="session-header">
							<div class="session-head-row">
								<span class="q-num">{unitNumber}</span>
								<div>
									<p class="q-eyebrow">今日の道</p>
									<h1 class="session-title">{unit.name}</h1>
								</div>
							</div>
							<p class="session-sub">忘れた頃の復習と、新しい1問ずつ。今日のぶんだけでOK。</p>
							<div class="session-progress">
								<div class="session-bar-track">
									<div data-progress-bar class="session-bar-fill" />
								</div>
								<span data-progress-label class="session-progress-label">
									…
								</span>
							</div>
						</header>

						<div data-cards class="session-cards">
							{questions.map((question) => (
								<QuestionCard question={question} />
							))}
						</div>

						{/* 今日のぶんが無いとき */}
						<div data-empty hidden class="session-empty">
							<p class="session-empty-title">今日のぶんは完了！</p>
							<p class="session-empty-sub">
								この単元で今日復習する問題はありません。また明日、忘れた頃に戻ってきましょう。
							</p>
							<a href="/" class="q-btn-primary session-empty-link">
								ホームに戻る
							</a>
						</div>

						{/* 終了サマリ */}
						<div data-summary hidden class="session-summary">
							<p class="session-summary-title">今日のぶん、完了！</p>
							<p class="session-summary-stat">
								<span data-summary-correct>0</span> / <span data-summary-total>0</span> 問 正解
							</p>
							<p class="session-summary-readiness">
								{unit.name}の理解度: <strong data-summary-readiness>0%</strong>
							</p>
							<a href="/" class="q-btn-primary session-empty-link">
								ホームに戻る
							</a>
						</div>

						<div class="session-nav">
							<button type="button" data-next class="session-next">
								次の問題へ
							</button>
						</div>
					</div>
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
