/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../components/Header";
import { unitBasedTabs } from "../../src/data/units";
import { YEARS } from "../../src/types/index";

// 年度・単元別の演習問題一覧。全単元(unitBasedTabs)×全年度(YEARS)のマトリクスで、
// 各単元が出題された年度のセルから /unit-x/{year} の演習ページへ遷移する。
export default createRoute((c) => {
	// 単元ページと同方針でエッジキャッシュ（純粋な静的マトリクス）。
	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	return c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="container mx-auto max-w-4xl px-4 py-8">
				<section class="py-2">
					<p class="home-eyebrow">過去問アーカイブ</p>
					<h1 class="home-title">年度・単元別 演習問題一覧</h1>
					<p class="home-lede">
						解きたい単元と年度を選んでください。2013〜2017年度の全演習問題に直接アクセスできます。
					</p>
				</section>

				<div class="exercises-table-wrap">
					<table class="exercises-table">
						<thead>
							<tr>
								<th scope="col" class="exercises-th-unit">
									単元
								</th>
								{YEARS.map((year) => (
									<th scope="col" class="exercises-th-year">
										{year}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{unitBasedTabs.map((unit, index) => {
								const availableYears = new Set(unit.examMapping.map((mapping) => mapping.year));
								return (
									<tr>
										<th scope="row" class="exercises-td-unit">
											<span class="exercises-unit-num">{index + 1}</span>
											{unit.name}
										</th>
										{YEARS.map((year) =>
											availableYears.has(year) ? (
												<td class="exercises-td">
													<a href={`/${unit.id}/${year}`} class="exercises-link">
														解く
													</a>
												</td>
											) : (
												<td class="exercises-td exercises-td-empty">—</td>
											),
										)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</main>
		</>,
		{
			title: "年度・単元別 演習問題一覧 - 基本情報技術 I",
			description:
				"明治大学 基本情報技術 I の全単元×全年度（2013〜2017）の演習問題一覧。単元と年度を選んで過去問演習にアクセスできます。",
		},
	);
});
