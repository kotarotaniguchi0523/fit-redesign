export function subscribeToStorageChanges(
	storageKeys: readonly string[],
	customEventName: string,
	onStoreChange: () => void,
): () => void {
	const onStorage = (event: StorageEvent): void => {
		if (event.key !== null && storageKeys.includes(event.key)) {
			onStoreChange();
		}
	};
	window.addEventListener("storage", onStorage);
	window.addEventListener(customEventName, onStoreChange);
	return (): void => {
		window.removeEventListener("storage", onStorage);
		window.removeEventListener(customEventName, onStoreChange);
	};
}
