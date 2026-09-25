import type { DeepReadonly } from "../../../lib/immutable";
import type {
	ChallengeId,
	ExamId,
	ExamNumber,
	Question,
	QuestionId,
	UnitTabId,
	Year,
} from "../../../types";

export type PlayerQuestion = DeepReadonly<Question>;
export type PlayerMode = "exam" | "question";

export type ExamPlayerProps = Readonly<{
	examId: ExamId;
	examNumber: ExamNumber;
	year: Year;
	unitId: UnitTabId;
	playerTitle: string;
	questions: readonly PlayerQuestion[];
	mode: PlayerMode;
	requestedQuestionId?: QuestionId;
	initialChallengeId?: ChallengeId;
	initialView: "player" | "result";
}>;
