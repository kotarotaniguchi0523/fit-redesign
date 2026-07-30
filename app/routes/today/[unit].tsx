/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { unitBasedTabs } from "../../data/units";

/** 廃止した「今日の道」から、同じ単元の最初の年度へ移動する互換ルート。 */

export default createRoute((c) => {
	const unitId = c.req.param("unit");
	const unit = unitBasedTabs.find((tab) => tab.id === unitId);

	if (!unit) {
		return c.notFound();
	}

	const firstYear = unit.examMapping[0]?.year;
	return firstYear ? c.redirect(`/${unit.id}/${firstYear}`, 301) : c.notFound();
});
