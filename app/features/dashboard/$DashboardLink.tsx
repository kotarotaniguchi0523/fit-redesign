interface DashboardLinkProps {
	className: string;
}

export default function DashboardLink({ className }: DashboardLinkProps) {
	return (
		<a href="/dashboard" class={className}>
			<span class="hidden sm:inline">学習進捗</span>
			<span class="sm:hidden">進捗</span>
		</a>
	);
}
