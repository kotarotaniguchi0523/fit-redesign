import { useCallback, useSyncExternalStore } from "react";

export function normalizePath(pathname: string): string {
	if (pathname.length <= 1) return pathname;
	return pathname.replace(/\/+$/, "") || "/";
}

function getPath(): string {
	return normalizePath(window.location.pathname);
}

function subscribe(callback: () => void): () => void {
	window.addEventListener("popstate", callback);
	return () => window.removeEventListener("popstate", callback);
}

export function useRoute() {
	const path = useSyncExternalStore(subscribe, getPath, getPath);

	const navigate = useCallback((to: string) => {
		if (!to.startsWith("/") || to.startsWith("//")) return;
		const normalizedTo = normalizePath(to);
		const currentPath = normalizePath(window.location.pathname);
		if (normalizedTo !== currentPath) {
			window.history.pushState(null, "", normalizedTo);
			window.dispatchEvent(new PopStateEvent("popstate"));
		}
	}, []);

	return { path, navigate } as const;
}
