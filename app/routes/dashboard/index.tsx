/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";

export default createRoute((c) => {
	// userId は global.d.ts の ContextVariableMap augmentation で型付け済み（as 不要）。
	return c.redirect(`/dashboard/${c.var.userId}`);
});
