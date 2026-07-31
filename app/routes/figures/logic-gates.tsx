import { createRoute } from "honox/factory";
import { Figure } from "../../components/figures/Figure";
import { LOGIC_CIRCUIT_PROTOTYPE } from "../../features/figures/logic-circuit-prototype";

export default createRoute((c) => {
	const prototype = LOGIC_CIRCUIT_PROTOTYPE;

	return c.render(
		<main class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
			<header class="mb-6">
				<p class="text-sm font-semibold text-gray-500">図表プレビュー</p>
				<h1 class="mt-1 text-2xl font-bold text-gray-950">{prototype.title}</h1>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{prototype.description}</p>
			</header>

			<section class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 class="sr-only">問題ページ用Hono JSX</h2>
				<div class="mx-auto w-full max-w-4xl overflow-hidden">
					<Figure data={prototype.figure} />
				</div>
			</section>

			<div class="mt-5 flex flex-wrap items-center gap-3 text-sm">
				<a
					href="/figures/logic-gates.svg"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex min-h-11 items-center rounded-lg bg-gray-950 px-4 font-semibold text-white"
				>
					SVGを開く
				</a>
				<a
					href="/figures/logic-gates.png"
					target="_blank"
					rel="noopener noreferrer"
					class="font-semibold text-gray-700 underline underline-offset-4"
				>
					Takumi PNGを開く
				</a>
				<a href="/unit-logic/2015" class="font-semibold text-gray-700 underline underline-offset-4">
					実際の問題ページを見る
				</a>
			</div>
		</main>,
		{ title: `${prototype.title} | プレビュー` },
	);
});
