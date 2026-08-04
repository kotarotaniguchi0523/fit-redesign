import * as z from "zod/mini";

/**
 * Browser trust-boundary schemas.
 *
 * These values cross between untrusted browser storage or URL input and the
 * application. Keeping their canonical definitions on Zod Mini avoids shipping
 * the full Zod API to islands while allowing the same schemas to be reused by
 * Hono validators and server-side domain functions.
 */

const questionIdBrand: unique symbol = Symbol("QuestionId");
const unitTabIdBrand: unique symbol = Symbol("UnitTabId");
const syncKeyBrand: unique symbol = Symbol("SyncKey");

export const QuestionIdSchema = z
	.string("questionId は文字列である必要があります")
	.check(
		z.regex(
			/^exam[1-9]-(2013|2014|2015|2016|2017)-q[1-9]\d*$/,
			"questionId は exam{1-9}-{2013..2017}-q{positive} 形式である必要があります",
		),
	)
	.brand<typeof questionIdBrand>();

export const UnitTabIdSchema = z
	.string("unit id は文字列である必要があります")
	.check(
		z.regex(
			/^unit-[a-z0-9]+(?:-[a-z0-9]+)*$/,
			"unit id は unit-{kebab-case} 形式である必要があります",
		),
	)
	.brand<typeof unitTabIdBrand>();

export const RevealedAtSchema = z.int().check(z.positive());

export const SyncKeySchema = z
	.string()
	.check(z.regex(/^[A-Za-z0-9_-]{43}$/, "同期キーの形式が正しくありません"))
	.brand<typeof syncKeyBrand>();

export const ProgressEntrySchema = z.readonly(
	z.strictObject({
		questionId: QuestionIdSchema,
		unitId: UnitTabIdSchema,
		revealedAt: RevealedAtSchema,
	}),
);

export const ProgressEntryListSchema = z.readonly(z.array(ProgressEntrySchema));

export const ProgressSyncRequestSchema = z.readonly(
	z.strictObject({
		entries: z.readonly(z.array(ProgressEntrySchema).check(z.maxLength(300))),
	}),
);

// Hono's validator inspects the object shape, so keep this as a direct object.
// It is intentionally not strict because real requests include other headers.
export const SyncHeaderSchema = z.object({
	"x-sync-key": SyncKeySchema,
});

export const ProgressSnapshotSchema = z.record(z.string(), z.unknown());

export type QuestionId = z.infer<typeof QuestionIdSchema>;
export type UnitTabId = z.infer<typeof UnitTabIdSchema>;
export type RevealedAt = z.infer<typeof RevealedAtSchema>;
export type ProgressEntry = z.infer<typeof ProgressEntrySchema>;
export type SyncKey = z.infer<typeof SyncKeySchema>;
