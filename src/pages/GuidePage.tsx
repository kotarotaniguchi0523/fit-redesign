import { Header } from "../components/Header";
import GuideContent from "./guide.mdx";

export function GuidePage() {
	return (
		<div className="min-h-screen bg-[#faf9f7] bg-texture">
			<Header />
			<main className="container mx-auto px-4 py-8 max-w-3xl">
				<article className="guide-content">
					<GuideContent />
				</article>
			</main>
		</div>
	);
}
