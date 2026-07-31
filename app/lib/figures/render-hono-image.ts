import { prepareImages } from "@takumi-rs/helpers";
import { fromHtml } from "@takumi-rs/helpers/html";
import initWasm, { Renderer } from "@takumi-rs/wasm";
import wasmModule from "@takumi-rs/wasm/auto";
import type { JSX } from "hono/jsx/jsx-runtime";
import type { FigureCanvas } from "../../features/figures/logic-circuit-prototype";

const MIN_CANVAS_SIDE = 64;
const MAX_CANVAS_SIDE = 2048;
type WasmSource = WebAssembly.Module | ArrayBuffer;

let rendererPromise: Promise<Renderer> | undefined;

function getRenderer(): Promise<Renderer> {
	rendererPromise ??= (async (): Promise<Renderer> => {
		// auto は Workers では WebAssembly.Module、Vite SSR では ArrayBuffer の Promise を返す。
		const source = await (wasmModule as unknown as WasmSource | Promise<WasmSource>);
		await initWasm({ module_or_path: source });
		return new Renderer();
	})().catch((error: unknown) => {
		rendererPromise = undefined;
		throw error;
	});
	return rendererPromise;
}

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
	const { node, stylesheets } = fromHtml(html);
	const images = await prepareImages({ node });
	const renderer = await getRenderer();
	const image = await renderer.render(node, {
		width: canvas.width,
		height: canvas.height,
		format: "png",
		lang: "en",
		images,
		stylesheets,
	});

	const bytes = new Uint8Array(image);
	const body = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(body).set(bytes);
	return body;
}
