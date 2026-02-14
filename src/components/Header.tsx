import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import { useRoute } from "../hooks/useRoute";

export function Header() {
	const { path, navigate } = useRoute();
	const isGuide = path === "/guide";

	return (
		<Navbar
			maxWidth="full"
			className="bg-linear-to-r from-[#1e3a5f] to-[#152a45] text-white border-b-2 border-[#c9a227]"
		>
			<NavbarBrand className="gap-4">
				<a
					href="/"
					onClick={(e) => {
						e.preventDefault();
						navigate("/");
					}}
					className="flex items-center gap-4 no-underline text-white"
				>
					<div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
						<span className="text-xl">🎓</span>
					</div>
					<div className="flex flex-col">
						<span
							className="text-lg font-bold tracking-wide"
							style={{ fontFamily: "var(--font-serif)" }}
						>
							基本情報技術 I
						</span>
						<span className="text-xs text-white/70 tracking-widest">MEIJI UNIVERSITY</span>
					</div>
				</a>
			</NavbarBrand>

			<NavbarContent justify="end">
				<NavbarItem>
					<a
						href={isGuide ? "/" : "/guide"}
						onClick={(e) => {
							e.preventDefault();
							navigate(isGuide ? "/" : "/guide");
						}}
						className="text-sm text-white/80 hover:text-white transition-colors flex items-center gap-1.5"
					>
						{isGuide ? (
							<>
								<span>←</span>
								<span className="hidden sm:inline">ホームに戻る</span>
								<span className="sm:hidden">戻る</span>
							</>
						) : (
							<>
								<span>📖</span>
								<span className="hidden sm:inline">使い方ガイド</span>
								<span className="sm:hidden">使い方</span>
							</>
						)}
					</a>
				</NavbarItem>
			</NavbarContent>
		</Navbar>
	);
}
