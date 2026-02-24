import { HeroUIProvider } from "@heroui/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { useRoute } from "./hooks/useRoute";
import "./index.css";
import { GuidePage } from "./pages/GuidePage";
import { VerificationPage } from "./pages/VerificationPage";

function Router() {
	const { path, navigate } = useRoute();
	const isKnownRoute = path === "/" || path === "/guide" || path === "/verification";

	useEffect(() => {
		if (!isKnownRoute) {
			navigate("/", { replace: true });
		}
	}, [isKnownRoute, navigate]);

	switch (path) {
		case "/":
			return <App />;
		case "/guide":
			return <GuidePage />;
		case "/verification":
			return <VerificationPage />;
		default: {
			return null;
		}
	}
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<HeroUIProvider>
			<Router />
		</HeroUIProvider>
	</StrictMode>,
);
