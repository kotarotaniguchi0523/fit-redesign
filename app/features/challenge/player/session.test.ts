import * as assert from "remix/assert";
import { beforeEach, describe, it } from "remix/test";

import { QuestionSchema } from "../../../data/exams/schema.ts";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../../types/browser.ts";
import { ExamNumberSchema, UnitTabIdSchema, YearSchema } from "../../../types/domain.ts";
import { createInitialChallengeState } from "../model.ts";
import {
	ACTIVE_CHALLENGES_STORAGE_KEY,
	CHALLENGE_LOCKS_STORAGE_KEY,
	saveActiveChallenge,
} from "../storage.ts";
import { resolveInitialPlayerSession } from "./session.ts";
import type { ExamPlayerProps, PlayerQuestion } from "./types.ts";

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

// `remix test` は Node 上で動くため、このモジュールが読むブラウザー API を与える。
if (typeof globalThis.localStorage === "undefined") {
	const store = new Map<string, string>();
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
			setItem: (key: string, value: string) => void store.set(key, String(value)),
			removeItem: (key: string) => void store.delete(key),
			clear: () => store.clear(),
			key: (index: number) => [...store.keys()][index] ?? null,
			get length() {
				return store.size;
			},
		},
		configurable: true,
	});
}
if (typeof globalThis.window === "undefined") {
	Object.defineProperty(globalThis, "window", {
		value: {
			history: { replaceState: () => {} },
			location: { href: "http://localhost/" },
			addEventListener: () => {},
			removeEventListener: () => {},
		},
		configurable: true,
	});
}

describe("resolveInitialPlayerSession", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState({}, "", "/unit-base-conversion/2013/exam/1");
	});

	// @lat: [[testing#Challenge client and player#Initial session is prepared without committing storage during render]]
	it("prepares a new attempt without writing it before the mount commit", () => {
		const session = resolveInitialPlayerSession(props);

		assert.equal(session.kind, "new");
		assert.equal(session.phase, "player");
		assert.deepEqual(session.state?.questionIds, [q1, q2]);
		assert.equal(localStorage.getItem(ACTIVE_CHALLENGES_STORAGE_KEY), null);
		assert.equal(localStorage.getItem(CHALLENGE_LOCKS_STORAGE_KEY), null);
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

		assert.equal(session.kind, "resume");
		assert.equal(session.phase, "resume");
		assert.equal(session.state?.challengeId, challengeId);
		assert.equal(session.state?.currentIndex, 1);
	});
});
