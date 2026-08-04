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

function freezeRecursively(value: unknown): void {
	if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
		return;
	}
	Reflect.ownKeys(value)
		.map((key) => Reflect.get(value, key))
		.forEach(freezeRecursively);
	Object.freeze(value);
}

export function deepFreeze<Value>(value: Value): asserts value is Value & DeepReadonly<Value> {
	freezeRecursively(value);
}
