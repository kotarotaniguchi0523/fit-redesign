import { z } from "zod";
import { getUserAnswerHistory } from "../../../server/answerRepository";
import { badRequest, json, route } from "../../../server/http";

export const prerender = false;

const HistoryQuerySchema = z.object({
	userId: z.string().min(1),
});

export const GET = route("Answer history error:", async ({ context, db }) => {
	const parsed = HistoryQuerySchema.safeParse({
		userId: context.url.searchParams.get("userId"),
	});

	if (!parsed.success) {
		return badRequest(parsed.error.issues);
	}

	const { userId } = parsed.data;

	const answers = await getUserAnswerHistory(db, userId);

	return json({ answers });
});
