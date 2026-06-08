/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../components/Header";
import { SITE_URL } from "../../src/data/site";
import { buildUnitManifest } from "../../src/utils/questionManifest";
import { YEARS } from "../../src/types/index";

// 旧 src/pages/index.astro（学習ホーム）を HonoX ルートへ移植。
// study-home の進捗計算は app/client.ts の命令的 client script（別オーナー）が
// data-study-home / data-manifest を読んで配線する。ここは描画済み DOM を出力するだけ。
export default createRoute(async (c) => {
	const manifest = await buildUnitManifest();
	// `</script>` でスクリプトが途切れないよう `<` をエスケープ（JSON.parse は復元する）
	const manifestJson = JSON.stringify(manifest).replace(/</g, "\\u003c");
	const fallbackCta = manifest[0] ? `/today/${manifest[0].id}` : "/";

	// JSON-LD: WebSite + Course
	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				name: "基本情報技術 I - 明治大学",
				url: `${SITE_URL}/`,
				description:
					"明治大学の基本情報技術 I 講義の演習問題サイト。2013〜2017年度の9単元・全問題を掲載。",
				inLanguage: "ja",
				publisher: { "@type": "EducationalOrganization", name: "明治大学" },
			},
			{
				"@type": "Course",
				name: "基本情報技術 I",
				description:
					"基数変換、負数表現、浮動小数点、論理演算、集合と確率、オートマトン、符号理論、データ構造、ソート・探索の9単元を学習する情報技術の基礎講義。",
				provider: { "@type": "EducationalOrganization", name: "明治大学" },
				educationalLevel: "大学学部",
				inLanguage: "ja",
				numberOfCredits: 2,
				hasCourseInstance: YEARS.map((y) => ({
					"@type": "CourseInstance",
					name: `基本情報技術 I (${y}年度)`,
					courseMode: "onsite",
				})),
			},
		],
	};

	// buildUnitManifest は SSR でリクエストごとに実行されるため、エッジキャッシュを効かせる
	// （[unit]/[year].tsx と同方針）。
	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	return c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="container mx-auto max-w-4xl px-4 py-8">
					<div data-study-home>
						<script
							data-manifest
							type="application/json"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: 進捗計算用マニフェストの埋め込み（旧 Astro set:html と同等）
							dangerouslySetInnerHTML={{ __html: manifestJson }}
						/>

						{/* ヒーロー */}
						<section class="py-2">
							<p class="home-eyebrow">基本情報技術の演習</p>
							<h1 class="home-title">勉強が嫌いな日でも、まず今日のぶんだけ。</h1>
							<p class="home-lede">
								何から手をつけるか迷わなくて大丈夫。アプリが「今日やる分」を少しずつ出します。間違えた問題は、忘れた頃にまた戻ってきます。
							</p>
						</section>

						{/* 試験本番メーター ＋ 今日の道 */}
						<section class="home-hero-card">
							<div class="home-meter">
								<div class="home-meter-head">
									<span class="home-meter-label">いまの仕上がり</span>
									<span data-overall-value class="home-meter-value">
										—
									</span>
								</div>
								<div class="home-meter-track">
									<div data-overall-bar class="home-meter-fill" style="width:0%" />
								</div>
								<p class="home-meter-note">
									今日やる分: <strong data-overall-due>—</strong> 問
								</p>
							</div>
							<a data-today-cta href={fallbackCta} class="home-cta">
								<span data-cta-label class="home-cta-label">
									今日の道を始める
								</span>
								<span data-cta-sub class="home-cta-sub">
									まずは1問だけでもOK
								</span>
							</a>
						</section>

						{/* 単元別の仕上がり */}
						<section class="mt-8">
							<div class="home-section-head">
								<h2 class="home-section-title">単元ごとの仕上がり</h2>
								<a href="/slide-only" class="home-textlink">
									講義資料だけ見る
								</a>
							</div>

							<div class="home-unit-list">
								{manifest.map((unit, index) => (
									<div data-unit-row={unit.id} class="home-unit-row">
										<a href={`/today/${unit.id}`} class="home-unit-link">
											<span class="home-unit-num">{index + 1}</span>
											<div class="home-unit-main">
												<div class="home-unit-titlerow">
													<span class="home-unit-name">{unit.name}</span>
													<span data-unit-due hidden class="home-unit-due" />
												</div>
												<p class="home-unit-desc">{unit.description}</p>
												<div class="home-unit-meterrow">
													<div class="home-unit-track">
														<div data-unit-bar class="home-unit-fill" style="width:0%" />
													</div>
													<span data-unit-value class="home-unit-value">
														0%
													</span>
												</div>
											</div>
										</a>
										<a href={`/${unit.id}/${unit.primaryYear}`} class="home-unit-practice">
											演習を見る →
										</a>
									</div>
								))}
							</div>

							<p class="home-foot-note">
								「演習を見る」から各単元の演習ページへ。年度ごとの問題はそこで選べます。
							</p>
						</section>
					</div>
				</div>
			</main>
		</>,
		{
			title: "基本情報技術 I - 明治大学",
			description:
				"明治大学の基本情報技術 I 講義の演習問題サイト。基数変換・論理演算・オートマトンなど9単元、2013〜2017年度の全問題を掲載。",
			jsonLd,
		},
	);
});
