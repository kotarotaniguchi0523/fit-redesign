import { createRoute } from "honox/factory";

// 試験ページは純静的コンテンツ。SSG プラグインは使わず、Workers の SSR + エッジキャッシュ
// (Cache-Control: 初回描画後はエッジで実質静的)。実データ化は raq タスクで行う。
export default createRoute((c) => {
	const unit = c.req.param("unit");
	const year = c.req.param("year");
	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");
	return c.render(
		<h1>
			{unit} / {year}
		</h1>,
		{ title: `${unit} ${year}` },
	);
});
