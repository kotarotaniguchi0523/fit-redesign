import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { USER_ID_KEY } from "../constants";
import { type UserId, UserIdSchema } from "../types";

export const USER_ID_COOKIE_NAME = USER_ID_KEY;
const USER_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface UserIdentityVariables {
	userId: UserId;
	userIdCookieIssued: boolean;
}

function cookieIsSecure(c: Context): boolean {
	return new URL(c.req.url).protocol === "https:";
}

export function readUserIdCookie(c: Context): UserId | null {
	const parsed = UserIdSchema.safeParse(getCookie(c, USER_ID_COOKIE_NAME));
	return parsed.success ? parsed.data : null;
}

export function setUserIdCookie(c: Context, userId: UserId): void {
	setCookie(c, USER_ID_COOKIE_NAME, userId, {
		path: "/",
		maxAge: USER_ID_COOKIE_MAX_AGE,
		httpOnly: true,
		secure: cookieIsSecure(c),
		sameSite: "Lax",
	});
}

export function ensureUserIdentity(c: Context): UserIdentityVariables {
	const existingUserId = readUserIdCookie(c);
	if (existingUserId) {
		return { userId: existingUserId, userIdCookieIssued: false };
	}

	const userId = UserIdSchema.parse(crypto.randomUUID());
	setUserIdCookie(c, userId);
	return { userId, userIdCookieIssued: true };
}
