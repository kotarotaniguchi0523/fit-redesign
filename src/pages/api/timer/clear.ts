import { z } from "zod";
import { badRequest, json, route } from "../../../server/http";
import { clearUserQuestionRecords } from "../../../server/timerRepository";

export const prerender = false;

const ClearQuerySchema = z.object({
	userId: z.string().min(1),
	questionId: z.string().min(1),
});

export const DELETE = route("Timer clear error:", async ({ context, db }) => {
	const parsed = ClearQuerySchema.safeParse({
		userId: context.url.searchParams.get("userId"),
		questionId: context.url.searchParams.get("questionId"),
	});

	if (!parsed.success) {
		return badRequest(parsed.error.issues);
	}

	const { userId, questionId } = parsed.data;
	await clearUserQuestionRecords(db, userId, questionId);

	return json({ success: true });
});
