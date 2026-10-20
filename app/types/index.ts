export type {
	Exam,
	ExamMeta,
	FigureData,
	Question,
} from "../data/exams/schema";
export type { ExamByYear, Slide, Unit, UnitBasedTab } from "./content";
export {
	SlideSchema,
	UnitBasedTabsSchema,
	UnitSchema,
} from "./content";
export type {
	ChallengeId,
	ExamId,
	ExamNumber,
	Judgment,
	QuestionId,
	SyncKey,
	UnitTabId,
	Year,
} from "./domain";
export {
	ExamNumberSchema,
	isYear,
	MEIJI_FIT_BASE,
	ProgressEntrySchema,
	SlideIdSchema,
	SyncKeySchema,
	YEARS,
} from "./domain";

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
} from "./figures";
