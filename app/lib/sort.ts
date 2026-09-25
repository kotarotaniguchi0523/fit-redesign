export function sortNewestFirst<Value extends Readonly<{ updatedAt: number }>>(
	values: readonly Value[],
): Value[] {
	return values.toSorted((left, right) => right.updatedAt - left.updatedAt);
}
