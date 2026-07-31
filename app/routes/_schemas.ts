import { z } from "zod";
import { ProgressEntry } from "../server/progressEntry";

const ProgressSyncSchema = z
	.object({
		entries: z.array(ProgressEntry.schema).max(300).readonly(),
	})
	.strict()
	.readonly();

export const ProgressSync = { schema: ProgressSyncSchema } as const;
