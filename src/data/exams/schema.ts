import { z } from "zod";
import { YEARS } from "../../types";

const YearSchema = z.enum(YEARS);
const ExamNumberSchema = z.number().int().min(1).max(9);

export const JsonExamFilePathSchema = z.string().regex(/^..\/exams-json\/exam\d+-\d{4}\.json$/, {
	error: "exam json path must match ../exams-json/exam{n}-{year}.json",
});

export const ParsedJsonExamFilePathSchema = JsonExamFilePathSchema.transform((filePath) => {
	const match = filePath.match(/exam(\d+)-(\d{4})\.json$/);
	if (!match) {
		// Defensive fallback. Regex above should guarantee this path.
		throw new Error(`invalid exam json path: ${filePath}`);
	}
	return {
		examNumber: Number(match[1]),
		year: match[2],
	};
}).pipe(
	z.object({
		examNumber: ExamNumberSchema,
		year: YearSchema,
	}),
);

const QuestionOptionSchema = z.object({
	label: z.string().min(1),
	value: z.string(),
	isCorrect: z.boolean().optional(),
});

const PointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

const StateNodeSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	x: z.number(),
	y: z.number(),
	isInitial: z.boolean().optional(),
	isAccepting: z.boolean().optional(),
});

const TransitionSchema = z.object({
	from: z.string().min(1),
	to: z.string().min(1),
	label: z.string().min(1),
	curveOffset: z.number().optional(),
});

const TreeNodeSchema: z.ZodType<unknown> = z.lazy(() =>
	z.object({
		value: z.union([z.string(), z.number()]),
		left: TreeNodeSchema.optional(),
		right: TreeNodeSchema.optional(),
	}),
);

const TruthTableSchema = z.object({
	type: z.literal("truthTable"),
	columns: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })),
	rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))),
});

const DataTableSchema = z.object({
	type: z.literal("dataTable"),
	columns: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })),
	rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
});

const FigureDataSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("stateDiagram"),
		nodes: z.array(StateNodeSchema),
		transitions: z.array(TransitionSchema),
	}),
	z.object({
		type: z.literal("binaryTree"),
		root: TreeNodeSchema,
	}),
	TruthTableSchema,
	z.object({
		type: z.literal("parityCheck"),
		data: z.array(z.array(z.number())),
	}),
	DataTableSchema,
	z.object({
		type: z.literal("huffmanTable"),
		data: z.object({
			characters: z.array(z.string()),
			probabilities: z.array(z.number()),
		}),
	}),
	z.object({
		type: z.literal("linkedListTable"),
		entries: z.array(
			z.object({
				address: z.union([z.string(), z.number()]),
				data: z.string(),
				pointer: z.union([z.string(), z.number()]),
			}),
		),
	}),
	z.object({
		type: z.literal("normalDistributionTable"),
		entries: z.array(
			z.object({
				u: z.number(),
				probability: z.number(),
			}),
		),
	}),
	z.object({
		type: z.literal("logicCircuit"),
		inputs: z.array(z.object({ id: z.string(), label: z.string(), x: z.number(), y: z.number() })),
		outputs: z.array(
			z.object({
				id: z.string(),
				label: z.string(),
				x: z.number(),
				y: z.number(),
				input: z.string(),
			}),
		),
		gates: z.array(
			z.object({
				id: z.string(),
				type: z.enum(["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"]),
				x: z.number(),
				y: z.number(),
			}),
		),
		wires: z.array(
			z.object({
				from: z.string(),
				to: z.string(),
				points: z.array(PointSchema).optional(),
			}),
		),
	}),
	z.object({
		type: z.literal("flowchart"),
		nodes: z.array(
			z.object({
				id: z.string(),
				type: z.enum(["start", "end", "process", "decision", "connector"]),
				label: z.string(),
				x: z.number(),
				y: z.number(),
				width: z.number().optional(),
				height: z.number().optional(),
			}),
		),
		edges: z.array(
			z.object({
				from: z.string(),
				to: z.string(),
				label: z.string().optional(),
				fromSide: z.enum(["bottom", "right", "left", "top"]).optional(),
				toSide: z.enum(["top", "right", "left", "bottom"]).optional(),
				points: z.array(PointSchema).optional(),
			}),
		),
		width: z.number().optional(),
		height: z.number().optional(),
	}),
]);

const QuestionSchema = z.object({
	id: z.string().min(1),
	number: z.number().int().positive(),
	text: z.string().min(1),
	options: z.array(QuestionOptionSchema).optional(),
	answer: z.string().min(1),
	explanation: z.string().optional(),
	figureDescription: z.string().optional(),
	figureData: FigureDataSchema.optional(),
});

export const ExamJsonSchema = z.object({
	id: z.string().regex(/^exam\d+-\d{4}$/),
	number: ExamNumberSchema,
	title: z.string().min(1),
	pdfPath: z.string().startsWith("/pdf/"),
	answerPdfPath: z.string().startsWith("/pdf/"),
	questions: z.array(QuestionSchema),
});

export const ExamsMetaSchema = z.object({
	version: z.literal(1),
	exams: z.array(
		z.object({
			examNumber: ExamNumberSchema,
			title: z.string().min(1),
			availableYears: z.array(YearSchema),
		}),
	),
});

export { YearSchema };
