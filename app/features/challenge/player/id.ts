import type { ChallengeId } from "../../../types";
import { ChallengeIdSchema } from "../../../types/browser";

export function generateChallengeId(): ChallengeId {
	if (typeof crypto.randomUUID === "function") {
		return ChallengeIdSchema.parse(crypto.randomUUID());
	}
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return ChallengeIdSchema.parse(
		`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
	);
}
