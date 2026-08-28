import { expect, test } from "vitest"
import { PATHS } from "@/ui/lib/constants"
import { toPageContext } from "./page-context"
import { catchResponse, TEST_CONTEXT } from "./test-harness"
import type { ProjectContextRefusal } from "./types"

function redirectFor(reason: ProjectContextRefusal): Response {
	return catchResponse(() => toPageContext({ ok: false, reason }))
}

test("sends a visitor who is not signed in to the login page", () => {
	const response = redirectFor("anonymous")

	expect(response.status).toBe(302)
	expect(response.headers.get("Location")).toBe(PATHS.LOGIN)
})

test.each<ProjectContextRefusal>([
	"config-invalid",
	"config-missing",
	"no-project",
])("sends a signed-in user with no browsable Project to setup (%s)", (reason) => {
	const response = redirectFor(reason)

	expect(response.status).toBe(302)
	expect(response.headers.get("Location")).toBe(PATHS.SETUP)
})

test("hands a resolved context straight through", () => {
	expect(toPageContext(TEST_CONTEXT)).toBe(TEST_CONTEXT)
})
