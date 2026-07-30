/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";

// 年度・単元別の演習問題一覧。全単元(unitBasedTabs)×全年度(YEARS)のマトリクスで、
// 各単元が出題された年度のセルから /unit-x/{year} の演習ページへ遷移する。
export default createRoute((c) => c.redirect("/", 301));
