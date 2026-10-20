import { describe, expect, it, vi } from "vitest";
import { subscribeToStorageChanges } from "./storageSubscription";

describe("subscribeToStorageChanges", () => {
	it("notifies for watched keys and its custom event, then unsubscribes", () => {
		const onStoreChange = vi.fn();
		const unsubscribe = subscribeToStorageChanges(
			["progress", "history"],
			"changed",
			onStoreChange,
		);

		window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
		window.dispatchEvent(new StorageEvent("storage", { key: "progress" }));
		window.dispatchEvent(new Event("changed"));

		expect(onStoreChange).toHaveBeenCalledTimes(2);

		unsubscribe();
		window.dispatchEvent(new StorageEvent("storage", { key: "history" }));
		window.dispatchEvent(new Event("changed"));

		expect(onStoreChange).toHaveBeenCalledTimes(2);
	});
});
