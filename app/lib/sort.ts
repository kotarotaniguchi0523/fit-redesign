export function sortNewestFirst<Value extends Readonly<{ updatedAt: number }>>(
	values: readonly Value[],
): Value[] {
	return [...values].sort((left, right) => right.updatedAt - left.updatedAt);
}
