import type { ChallengeId, ExamId, Judgment, QuestionId } from '../../types/index.ts'

export type { ChallengeId } from '../../types/index.ts'

export type CompletedAnswer = Readonly<{
	questionId: QuestionId
	elapsedMs: number
	judgment: Judgment
	createdAt: number
	updatedAt: number
}>

export type CompletedChallengePayload = Readonly<{
	challengeId: ChallengeId
	examId: ExamId | string
	createdAt: number
	updatedAt: number
	answers: readonly CompletedAnswer[]
}>
