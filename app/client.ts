import { createClient } from "honox/client";
import "./features/navigation/modeEntryTransition";

let examPlayerImport: Promise<unknown> | undefined;

function prefetchExamPlayerOnIntent(event: Event): void {
	const target = event.target;
	if (!(target instanceof Element && target.closest(".exam-start-link, .question-timer-link"))) {
		return;
	}
	if (!examPlayerImport) {
		const request = import("./features/challenge/$ExamPlayer");
		examPlayerImport = request;
		request.catch(() => {
			if (examPlayerImport === request) {
				examPlayerImport = undefined;
			}
		});
	}
}

document.addEventListener("pointerover", prefetchExamPlayerOnIntent, { passive: true });
document.addEventListener("focusin", prefetchExamPlayerOnIntent);

// islands の自動ハイドレーション
createClient();
