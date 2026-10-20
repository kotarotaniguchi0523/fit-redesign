import {
	ProgressEntryListSchema,
	ProgressEntrySchema,
	type ProgressEntry as ProgressEntryType,
} from "../types/domain";
import { schemaResult } from "./schemaResult";

export type ProgressEntry = ProgressEntryType;

export const ProgressEntry = {
	schema: ProgressEntrySchema,
	listSchema: ProgressEntryListSchema,
	parse: schemaResult(ProgressEntrySchema),
	parseList: schemaResult(ProgressEntryListSchema),
} as const;
