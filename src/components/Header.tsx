import { Navbar, NavbarBrand } from "@heroui/react";

export function Header() {
	return (
		<Navbar maxWidth="full" className="bg-blue-900 text-white">
			<NavbarBrand>
				<span className="text-xl font-bold">🎓 基本情報技術 I</span>
				<span className="ml-4 text-sm opacity-80">明治大学</span>
			</NavbarBrand>
		</Navbar>
	);
}
