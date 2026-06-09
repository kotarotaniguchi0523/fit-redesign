import { useActionState, useEffect } from "hono/jsx/dom";
import { USER_ID_KEY } from "../../constants";

interface DashboardLinkProps {
	className: string;
}

async function resolveDashboardHref(): Promise<string> {
	try {
		const userId = localStorage.getItem(USER_ID_KEY);
		if (userId) {
			return `/dashboard/${userId}`;
		}
	} catch {
		// Keep the generic dashboard entry when storage is unavailable.
	}
	return "/dashboard";
}

export default function DashboardLink({ className }: DashboardLinkProps) {
	const [href, resolveHref] = useActionState(resolveDashboardHref, "/dashboard");

	useEffect(() => {
		resolveHref();
	}, []);

	return (
		<a href={href} class={className}>
			<span class="hidden sm:inline">学習進捗</span>
			<span class="sm:hidden">進捗</span>
		</a>
	);
}
