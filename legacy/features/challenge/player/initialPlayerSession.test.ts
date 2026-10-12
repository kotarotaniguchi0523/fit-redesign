import { beforeEach, describe, expect, it } from "vitest";
import { QuestionSchema } from "../../../data/exams/schema";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../../types/browser";
import { ExamNumberSchema, UnitTabIdSchema, YearSchema } from "../../../types/domain";
import { createInitialChallengeState } from "../challenge";
import {
	ACTIVE_CHALLENGES_STORAGE_KEY,
	CHALLENGE_LOCKS_STORAGE_KEY,
	saveActiveChallenge,
} from "../challengeStorage";
import { resolveInitialPlayerSession } from "./initialPlayerSession";
import type { ExamPlayerProps, PlayerQuestion } from "./types";

const examId = ExamIdSchema.parse("exam1-2013");
const q1 = QuestionIdSchema.parse("exam1-2013-q1");
const q2 = QuestionIdSchema.parse("exam1-2013-q2");
const questions: readonly PlayerQuestion[] = [q1, q2].map((id, index) =>
	QuestionSchema.parse({ id, number: index + 1, text: `問題${index + 1}`, answer: "ア" }),
);

const props: ExamPlayerProps = {
	examId,
	examNumber: ExamNumberSchema.parse(1),
	year: YearSchema.parse("2013"),
	unitId: UnitTabIdSchema.parse("unit-base-conversion"),
	playerTitle: "小テスト1",
	questions,
	mode: "exam",
};

describe("resolveInitialPlayerSession", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState({}, "", "/unit-base-conversion/2013/exam/1");
	});

	// @lat: [[testing#Challenge client and player#Initial session is prepared without committing storage during render]]
	it("prepares a new attempt without writing it before the mount commit", () => {
		const session = resolveInitialPlayerSession(props);

		expect(session.kind).toBe("new");
		expect(session.phase).toBe("player");
		expect(session.state?.questionIds).toEqual([q1, q2]);
		expect(localStorage.getItem(ACTIVE_CHALLENGES_STORAGE_KEY)).toBeNull();
		expect(localStorage.getItem(CHALLENGE_LOCKS_STORAGE_KEY)).toBeNull();
	});

	// @lat: [[testing#Challenge client and player#Initial session is prepared without committing storage during render]]
	it("restores an existing attempt into the resume phase", () => {
		const challengeId = ChallengeIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
		const state = createInitialChallengeState({
			challengeId,
			scopeKey: "exam1-2013/exam",
			examId,
			mode: "exam",
			questionIds: [q1, q2],
			createdAt: 1_700_000_000_000,
			initialIndex: 1,
		});
		saveActiveChallenge(state);

		const session = resolveInitialPlayerSession(props);

		expect(session.kind).toBe("resume");
		expect(session.phase).toBe("resume");
		expect(session.state?.challengeId).toBe(challengeId);
		expect(session.state?.currentIndex).toBe(1);
	});
});
