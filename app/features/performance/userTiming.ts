/** Records a browser-only operation around synchronous JSX/DOM work for Chrome's User Timing track. */
export function measureUserInteraction(name: string, update: () => void): void {
	const startedAt = performance.now();
	update();
	performance.measure(name, { start: startedAt, end: performance.now() });
}
