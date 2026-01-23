import { Navbar, NavbarBrand } from "@heroui/react";

export function Header() {
    return (
        <Navbar
            maxWidth="full"
            className="bg-linear-to-r from-[#1e3a5f] to-[#152a45] text-white border-b-2 border-[#c9a227]"
        >
            <NavbarBrand className="gap-4">
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
                    <span className="text-xs text-white/70 tracking-widest">
                        MEIJI UNIVERSITY
                    </span>
                </div>
            </NavbarBrand>
        </Navbar>
    );
}
