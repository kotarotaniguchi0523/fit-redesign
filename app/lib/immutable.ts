type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DeepReadonly<Value> = Value extends Primitive
	? Value
	: Value extends (...args: never[]) => unknown
		? Value
		: Value extends readonly (infer Item)[]
			? readonly DeepReadonly<Item>[]
			: Value extends object
				? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
				: Value;

function freezeRecursivelyInPlace(value: unknown): void {
	if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
		return;
	}
	Reflect.ownKeys(value)
		.map((key) => Reflect.get(value, key))
		.forEach(freezeRecursivelyInPlace);
	Object.freeze(value);
}

/** Mutates an owned value by deeply freezing it before it is shared with consumers. */
export function deepFreezeInPlace<Value>(
	value: Value,
): asserts value is Value & DeepReadonly<Value> {
	freezeRecursivelyInPlace(value);
}
