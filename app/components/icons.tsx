import type { JSX } from "hono/jsx/jsx-runtime";

// 全画面共有の presentational SVG アイコン群（島の状態を持たない純描画）。
// island からも import される葉コンポーネント（features への依存は持たない）。

export function CopyIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<title>copy</title>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	);
}

export function CheckIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<title>copied</title>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

export function ErrorIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<title>copy failed</title>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
			/>
		</svg>
	);
}
