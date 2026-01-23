import { useState } from "react";
import { Header } from "./components/Header";
import { UnitTabs } from "./components/UnitTabs";
import type { Year } from "./types/index";

export default function App() {
	const [selectedYear, setSelectedYear] = useState<Year>("2017");

	return (
		<div className="min-h-screen bg-[#faf9f7] bg-texture">
			<Header />
			<main className="container mx-auto px-4 py-6 max-w-5xl">
				<UnitTabs selectedYear={selectedYear} onYearChange={setSelectedYear} />
			</main>
		</div>
	);
}
