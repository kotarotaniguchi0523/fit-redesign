import type { JSX } from "hono/jsx/jsx-runtime";

// 単元ごとの heroicons 風 outline アイコン（emoji を置き換える）。
// Header / components/icons と同系統の stroke ベース。未知 id は汎用アイコンにフォールバック。

function IconShell({
	className,
	children,
}: {
	className?: string;
	children: JSX.Element;
}): JSX.Element {
	return (
		<svg
			class={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

function unitPaths(unitId: string): JSX.Element {
	switch (unitId) {
		// 基数変換: 2進⇄10進の変換 = 双方向矢印
		case "unit-base-conversion":
			return (
				<>
					<path d="M7.5 21 3 16.5 7.5 12" />
					<path d="M3 16.5h13.5" />
					<path d="M16.5 3 21 7.5 16.5 12" />
					<path d="M21 7.5H7.5" />
				</>
			);
		// 負数表現: マイナス
		case "unit-negative":
			return (
				<>
					<path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
					<path d="M8.25 12h7.5" />
				</>
			);
		// 浮動小数点: 数値（電卓的なグリッド）
		case "unit-float":
			return (
				<>
					<rect x="3.75" y="3" width="16.5" height="18" rx="2" />
					<path d="M3.75 8.25h16.5" />
					<path d="M8.25 12v5.25M12 12v5.25M15.75 12v5.25" />
				</>
			);
		// 論理演算: チップ（論理回路）
		case "unit-logic":
			return (
				<>
					<rect x="4.5" y="4.5" width="15" height="15" rx="2" />
					<rect x="8.25" y="8.25" width="7.5" height="7.5" rx="1" />
					<path d="M9 4.5V2.25M15 4.5V2.25M9 21.75V19.5M15 21.75V19.5M19.5 9h2.25M19.5 15h2.25M2.25 9H4.5M2.25 15H4.5" />
				</>
			);
		// 集合と確率: ベン図（2円の重なり）
		case "unit-set-prob":
			return (
				<>
					<circle cx="9.25" cy="12" r="6" />
					<circle cx="14.75" cy="12" r="6" />
				</>
			);
		// オートマトン: 歯車（状態遷移の制御）
		case "unit-automaton":
			return (
				<>
					<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
					<path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
				</>
			);
		// 符号理論: シールド + チェック（誤り訂正）
		case "unit-ecc":
			return (
				<>
					<path d="M12 2.7A12 12 0 0 1 3.6 6 12 12 0 0 0 3 9.75c0 5.6 3.82 10.3 9 11.62 5.18-1.32 9-6.02 9-11.62 0-1.31-.21-2.57-.6-3.75A12 12 0 0 1 12 2.7Z" />
					<path d="M9 11.75 11.25 14 15 9.5" />
				</>
			);
		// データ構造: 二分木
		case "unit-data-structure":
			return (
				<>
					<circle cx="12" cy="5" r="2.25" />
					<circle cx="6" cy="18.5" r="2.25" />
					<circle cx="18" cy="18.5" r="2.25" />
					<path d="M10.4 6.6 7.6 16.9M13.6 6.6l2.8 10.3" />
				</>
			);
		// ソート・探索: 虫眼鏡
		case "unit-sort":
			return (
				<>
					<circle cx="11" cy="11" r="6.5" />
					<path d="m20 20-4.35-4.35" />
				</>
			);
		// フォールバック: モジュール（四角）
		default:
			return (
				<>
					<rect x="4" y="4" width="16" height="16" rx="2" />
					<path d="M4 9.5h16M9.5 9.5V20" />
				</>
			);
	}
}

export function UnitIcon({
	unitId,
	className,
}: {
	unitId: string;
	className?: string;
}): JSX.Element {
	return <IconShell className={className}>{unitPaths(unitId)}</IconShell>;
}
