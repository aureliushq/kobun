import { betterAuth } from "better-auth"
import { testUtils } from "better-auth/plugins"
import { afterEach, expect, test, vi } from "vitest"
import { createInMemoryDb } from "@/db/testing"
import { authOptions, getAuth } from "./auth.server"

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

afterEach(() => {
	vi.restoreAllMocks()
})

test("a signup without an AutoSend key does not call AutoSend", async () => {
	const fetch = vi.spyOn(globalThis, "fetch")
	const error = vi.spyOn(console, "error")
	const { close, db } = createInMemoryDb()
	try {
		const auth = betterAuth({
			...authOptions(env(), db),
			plugins: [testUtils()],
		})
		const { test: helpers } = await auth.$context
		await helpers.saveUser(helpers.createUser({ email: "new@example.com" }))

		expect(fetch).not.toHaveBeenCalled()
		expect(error).not.toHaveBeenCalled()
	} finally {
		close()
	}
})
