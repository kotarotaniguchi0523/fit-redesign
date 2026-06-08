import { Hono } from "hono";
import { ssgParams } from "hono/ssg";

const app = new Hono();
app.get(
	"/",
	ssgParams(() => [
		{ unit: "unit-base-conversion", year: "2013" },
		{ unit: "unit-base-conversion", year: "2014" },
		{ unit: "unit-negative", year: "2013" },
	]),
	(c) => {
		const unit = c.req.param("unit");
		const year = c.req.param("year");
		return c.render(
			<h1>
				{unit} / {year}
			</h1>,
			{ title: `${unit} ${year}` },
		);
	},
);
export default app;
