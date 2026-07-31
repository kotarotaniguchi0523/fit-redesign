import type { JSX } from "hono/jsx/jsx-runtime";
import { render } from "takumi-js";
import type { FigureCanvas } from "../../features/figures/logic-circuit-prototype";

const MIN_CANVAS_SIDE = 64;
const MAX_CANVAS_SIDE = 2048;

function assertCanvas(canvas: FigureCanvas): void {
	for (const [name, value] of Object.entries(canvas)) {
		if (!(Number.isInteger(value) && value >= MIN_CANVAS_SIDE && value <= MAX_CANVAS_SIDE)) {
			throw new RangeError(`${name} must be an integer between 64 and 2048`);
		}
	}
}

/** Hono JSXをHTMLへ確定し、WorkersではTakumi WASMでPNGへ変換する。 */
export async function renderHonoJsxToPng(
	element: JSX.Element,
	canvas: FigureCanvas,
): Promise<ArrayBuffer> {
	assertCanvas(canvas);
	const html = String(await element);
	const image = await render(html, {
		width: canvas.width,
		height: canvas.height,
		format: "png",
		lang: "en",
	});

	const bytes = new Uint8Array(image);
	const body = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(body).set(bytes);
	return body;
}
