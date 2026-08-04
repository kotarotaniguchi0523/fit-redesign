import { createRoute } from "honox/factory";
import { Figure } from "../../components/figures/Figure";
import { LOGIC_CIRCUIT_PROTOTYPE } from "../../features/figures/logic-circuit-prototype";

export default createRoute(async (c) => {
	const prototype = LOGIC_CIRCUIT_PROTOTYPE;
	const svg = String(await (<Figure data={prototype.figure} mode="fixed" />));

	return c.body(svg, 200, {
		"Cache-Control": "public, max-age=3600",
		"Content-Type": "image/svg+xml; charset=utf-8",
		"X-Content-Type-Options": "nosniff",
	});
});
