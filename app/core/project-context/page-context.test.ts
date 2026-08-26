import { expect, test } from "vitest"
import { PATHS } from "@/ui/lib/constants"
import { toPageContext } from "./page-context"
import { catchResponse, TEST_CONFIG } from "./test-harness"
import type { ProjectContextOk, ProjectContextRefusal } from "./types"

/** Only the shape matters here; the resolver's own tests cover its contents. */
const CONTEXT = {
	config: TEST_CONFIG,
	installationId: "1",
	name: "blog",
	ok: true,
	owner: "acme",
	projectRow: {},
	session: { user: { id: "user-1" } },
} as unknown as ProjectContextOk

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
	expect(toPageContext(CONTEXT)).toBe(CONTEXT)
})
