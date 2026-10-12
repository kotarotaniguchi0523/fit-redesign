import type { Handle } from 'remix/component'

/**
 * プレイヤーが使う presentational アイコン。状態を持たない純描画コンポーネント。
 */
function icon(children: () => unknown) {
	return function Icon(handle: Handle) {
		void handle
		return () => (
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				{children() as never}
			</svg>
		)
	}
}

export const MenuIcon = icon(() => <path d="M4 6h16M4 12h16M4 18h16" />)
export const CloseIcon = icon(() => <path d="m6 6 12 12M18 6 6 18" />)
export const ChevronLeftIcon = icon(() => <path d="m15 18-6-6 6-6" />)
export const ChevronRightIcon = icon(() => <path d="m9 18 6-6-6-6" />)
export const CheckIcon = icon(() => <polyline points="20 6 9 17 4 12" />)
export const PauseIcon = icon(() => <path d="M9 5v14M15 5v14" />)
export const TimerIcon = icon(() => (
	<>
		<circle cx="12" cy="13" r="8" />
		<path d="M12 9v4l2.5 1.5M10 2h4m-2 0v3M19 6l-1.5 1.5" />
	</>
))
export const AnswerSheetIcon = icon(() => (
	<>
		<path d="M7 3.5h7l4.5 4.5v12.5H7z" />
		<path d="M14 3.5V8h4.5M9.5 14l2 2 4-4" />
	</>
))
