import { z } from "zod";
import { badRequest, json, route } from "../../../server/http";
import { loadUserAttempts, upsertUser } from "../../../server/timerRepository";

export const prerender = false;

const LoadQuerySchema = z.object({
	userId: z.string().min(1),
});

export const GET = route("Timer load error:", async ({ context, db }) => {
	const parsed = LoadQuerySchema.safeParse({
		userId: context.url.searchParams.get("userId"),
	});

	if (!parsed.success) {
		return badRequest(parsed.error.issues);
	}

	const { userId } = parsed.data;
	await upsertUser(db, userId);
	const data = await loadUserAttempts(db, userId);

	return json({ records: data.records, syncedAt: Date.now() });
});
