/** 点列を SVG path の polyline（先頭 M、以降 L）文字列にする。図表の折れ線エッジ/ワイヤ共通。 */
export function pointsToPolyline(points: { x: number; y: number }[]): string {
	return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}
