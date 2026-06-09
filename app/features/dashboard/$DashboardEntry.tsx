import { useActionState, useEffect } from "hono/jsx/dom";
import { USER_ID_KEY } from "../../constants";

type EntryState = "loading" | "empty";

async function resolveDashboardEntry(): Promise<EntryState> {
	try {
		const userId = localStorage.getItem(USER_ID_KEY);
		if (userId) {
			location.replace(`/dashboard/${userId}`);
			return "loading";
		}
	} catch {
		// Treat unavailable storage as an empty dashboard.
	}
	return "empty";
}

export default function DashboardEntry() {
	const [state, resolveEntry] = useActionState(resolveDashboardEntry, "loading" as EntryState);

	useEffect(() => {
		resolveEntry();
	}, []);

	if (state === "loading") {
		return <p class="text-slate-500">読み込み中...</p>;
	}

	return (
		<div>
			<h1 class="text-2xl font-bold text-[#1e3a5f]" style="font-family: var(--font-serif)">
				まだ記録がありません
			</h1>
			<p class="mt-3 text-slate-600">
				問題を解くと、ここに学習の進捗が表示されます。まずは今日のぶんから。
			</p>
			<a href="/" class="q-btn-primary mt-6 inline-block w-auto px-6">
				今日の道を始める
			</a>
		</div>
	);
}
