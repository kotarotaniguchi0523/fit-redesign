import type { ChallengeId } from "../../../types";
import { ChallengeIdSchema } from "../../../types/browser";

export type InitialChallengeView = Readonly<{
	view: "player" | "result";
	challengeId?: ChallengeId;
}>;

export function readInitialChallengeView(search: string): InitialChallengeView {
	const query = new URLSearchParams(search);
	const challenge = ChallengeIdSchema.safeParse(query.get("challenge"));
	return {
		view: query.get("view") === "result" ? "result" : "player",
		challengeId: challenge.success ? challenge.data : undefined,
	};
}
