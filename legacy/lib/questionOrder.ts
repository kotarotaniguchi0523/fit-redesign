export function sortByQuestionId<Value extends Readonly<{ questionId: string }>>(
	values: readonly Value[],
): Value[] {
	return values.toSorted((left, right) => left.questionId.localeCompare(right.questionId));
}
