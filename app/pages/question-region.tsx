import type { Handle } from "remix/component";
import type { PlayerQuestion } from "../features/challenge/player/types.ts";
import { QuestionContent } from "../features/challenge/ui/question-content.tsx";

/**
 * 問題本体のみを返す Frame ソース。
 * `Document` を含めない（Remix ガイド: frame action は領域だけを返す）。
 */
export function QuestionRegion(handle: Handle<{ question: PlayerQuestion }>) {
	return () => <QuestionContent question={handle.props.question} />;
}
