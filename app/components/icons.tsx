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

export function TimerIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="13" r="8" />
			<path d="M12 9v4l2.5 1.5M10 2h4m-2 0v3M19 6l-1.5 1.5" />
		</svg>
	);
}

export function AnswerSheetIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M7 3.5h7l4.5 4.5v12.5H7z" />
			<path d="M14 3.5V8h4.5M9.5 14l2 2 4-4" />
		</svg>
	);
}

export function MenuIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<path d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	);
}

export function CloseIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<path d="m6 6 12 12M18 6 6 18" />
		</svg>
	);
}

export function PlayIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m8 5 12 7-12 7z" />
		</svg>
	);
}

export function PauseIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<path d="M9 5v14M15 5v14" />
		</svg>
	);
}

export function ChevronLeftIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m15 18-6-6 6-6" />
		</svg>
	);
}

export function ChevronRightIcon(): JSX.Element {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m9 18 6-6-6-6" />
		</svg>
	);
}
