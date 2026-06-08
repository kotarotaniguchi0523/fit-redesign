// @mdx-js/rollup でコンパイルされる .mdx を hono/jsx コンポーネントとして import するための型。
declare module "*.mdx" {
	import type { FC } from "hono/jsx";

	const MDXContent: FC;
	export default MDXContent;
}
