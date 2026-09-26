/** @jsxImportSource hono/jsx */
import { ssgParams } from "hono/ssg";
import { createRoute } from "honox/factory";
import { ExamPage, getExamSsgParams, resolveExamPage } from "../../../_examPage";

const renderExam = createRoute(async (c) => {
	const data = await resolveExamPage(c.req.param("unit"), c.req.param("year"), c.req.param("exam"));
	if (!data) {
		return c.notFound();
	}
	return c.render(<ExamPage data={data} />, {
		title: `小テスト${data.examNumber} - ${data.unit.name}・${data.year}年度`,
		description: "小テストを一問ずつ進め、問題ごとの時間と自己判定を記録できます。",
		noindex: true,
		noCanonical: true,
	});
});

export default createRoute(ssgParams(getExamSsgParams), ...renderExam);
