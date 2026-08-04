import { createRoute } from "honox/factory";
import { Figure } from "../../components/figures/Figure";
import { LOGIC_CIRCUIT_PROTOTYPE } from "../../features/figures/logic-circuit-prototype";
import { renderHonoJsxToPng } from "../../lib/figures/render-hono-image";

export default createRoute(async (c) => {
	const prototype = LOGIC_CIRCUIT_PROTOTYPE;
	const png = await renderHonoJsxToPng(
		<Figure data={prototype.figure} mode="raster" />,
		prototype.canvas,
	);

	return c.body(png, 200, {
		"Cache-Control": "public, max-age=3600",
		"Content-Type": "image/png",
		"X-Content-Type-Options": "nosniff",
	});
});
