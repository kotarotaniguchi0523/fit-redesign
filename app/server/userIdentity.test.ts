import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
	ensureUserIdentity,
	USER_ID_COOKIE_NAME,
	type UserIdentityVariables,
} from "./userIdentity";

function createIdentityTestApp() {
	const app = new Hono<{ Variables: UserIdentityVariables }>();
	app.use("*", async (c, next) => {
		const identity = ensureUserIdentity(c);
		c.set("userId", identity.userId);
		c.set("userIdCookieIssued", identity.userIdCookieIssued);
		await next();
	});
	app.get("/", (c) => c.json({ userId: c.var.userId, issued: c.var.userIdCookieIssued }));
	return app;
}

describe("userIdentity", () => {
	it("HttpOnly userId Cookie がない場合は発行する", async () => {
		const res = await createIdentityTestApp().request("http://localhost/");
		const body = await res.json<{ userId: string; issued: boolean }>();
		const setCookie = res.headers.get("Set-Cookie") ?? "";

		expect(body.issued).toBe(true);
		expect(setCookie).toContain(`${USER_ID_COOKIE_NAME}=${body.userId}`);
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=Lax");
		expect(setCookie).toContain("Path=/");
	});

	it("妥当な userId Cookie がある場合は再発行しない", async () => {
		const userId = "550e8400-e29b-41d4-a716-446655440000";
		const res = await createIdentityTestApp().request("http://localhost/", {
			headers: { Cookie: `${USER_ID_COOKIE_NAME}=${userId}` },
		});
		const body = await res.json<{ userId: string; issued: boolean }>();

		expect(body).toEqual({ userId, issued: false });
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});
});
