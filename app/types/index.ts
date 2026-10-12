export type {
	Exam,
	ExamMeta,
	FigureData,
	Question,
} from "../data/exams/schema.ts";
export type { ExamByYear, Slide, Unit, UnitBasedTab } from "./content.ts";
export {
	SlideSchema,
	UnitBasedTabsSchema,
	UnitSchema,
} from "./content.ts";
export type {
	ChallengeId,
	ExamId,
	ExamNumber,
	Judgment,
	QuestionId,
	SyncKey,
	UnitTabId,
	Year,
} from "./domain.ts";
export {
	ExamNumberSchema,
	isYear,
	MEIJI_FIT_BASE,
	ProgressEntrySchema,
	SlideIdSchema,
	SyncKeySchema,
	YEARS,
} from "./domain.ts";

// 図コンポーネントの型をre-export
export type {
	FlowchartEdge,
	FlowchartNode,
	LinkedListEntry,
	LogicGate,
	LogicInput,
	LogicOutput,
	LogicWire,
	NormalDistributionEntry,
	StateNode,
	Transition,
	TreeNode,
} from "./figures.ts";

// 同期 API が直接使う検証スキーマ（browser 信頼境界）
export {
	ChallengeIdSchema,
	EpochMillisecondsSchema,
	ExamIdSchema,
	JudgmentSchema,
	ProgressEntryListSchema,
	ProgressSyncRequestSchema,
	QuestionIdSchema,
} from './browser.ts'
export type { ProgressEntry } from './browser.ts'
