import { z } from "zod";
import { getLatestAnswers } from "../../../server/answerRepository";
import { badRequest, json, route } from "../../../server/http";

export const prerender = false;

const StatusQuerySchema = z.object({
	userId: z.string().min(1),
});

export const GET = route("Answer status error:", async ({ context, db }) => {
	const parsed = StatusQuerySchema.safeParse({
		userId: context.url.searchParams.get("userId"),
	});

	if (!parsed.success) {
		return badRequest(parsed.error.issues);
	}

	const { userId } = parsed.data;

	// D1 から最新回答を取得
	const statuses = await getLatestAnswers(db, userId);

	return json({ statuses });
});
