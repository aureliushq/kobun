import { expect, test } from "vitest"
import { getAuth } from "./auth.server"

function env() {
	return {
		BETTER_AUTH_SECRET: "secret-at-least-thirty-two-characters!",
		BETTER_AUTH_URL: "http://localhost:5173",
		DB: {},
	} as unknown as Env
}

test("builds Better Auth once per environment", () => {
	const shared = env()

	expect(getAuth(shared)).toBe(getAuth(shared))
})

test("builds a separate instance for another environment", () => {
	expect(getAuth(env())).not.toBe(getAuth(env()))
})
