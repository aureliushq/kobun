import { expect, test } from "vitest"
import { PATHS } from "@/ui/lib/constants"
import { toPageContext, toProjectPage } from "./page-context"
import {
	catchResponse,
	TEST_CONTEXT,
	TEST_NAME,
	TEST_OWNER,
	TEST_UNCONFIGURED_CONTEXT,
} from "./test-harness"
import type { ProjectContextRefusal } from "./types"

function redirectFor(reason: ProjectContextRefusal): Response {
	return catchResponse(() => toPageContext({ ok: false, reason }))
}

test("sends a visitor who is not signed in to the login page", () => {
	const response = redirectFor("anonymous")

	expect(response.status).toBe(302)
	expect(response.headers.get("Location")).toBe(PATHS.LOGIN)
})

test("sends a signed-in user with no Project for this repository to setup", () => {
	const response = redirectFor("no-project")

	expect(response.status).toBe(302)
	expect(response.headers.get("Location")).toBe(PATHS.SETUP)
})

test("sends a page that needs a Config to the Project's own dashboard", () => {
	// Not to setup: the Project exists, and setup is where one gets connected.
	// Sending it there is what bounced a freshly connected repository between
	// the two pages, forever (ADR-0007).
	const response = catchResponse(() => toPageContext(TEST_UNCONFIGURED_CONTEXT))

	expect(response.status).toBe(302)
	expect(response.headers.get("Location")).toBe(`/${TEST_OWNER}/${TEST_NAME}`)
})

test("hands a resolved context straight through", () => {
	expect(toPageContext(TEST_CONTEXT)).toBe(TEST_CONTEXT)
})

test("hands the Project's own page a Config it could not resolve", () => {
	expect(toProjectPage(TEST_UNCONFIGURED_CONTEXT)).toBe(
		TEST_UNCONFIGURED_CONTEXT,
	)
})

test("hands the Project's own page a resolved context straight through", () => {
	expect(toProjectPage(TEST_CONTEXT)).toBe(TEST_CONTEXT)
})

test.each<[ProjectContextRefusal, string]>([
	["anonymous", PATHS.LOGIN],
	["no-project", PATHS.SETUP],
])("still refuses %s on the Project's own page", (reason, location) => {
	const response = catchResponse(() => toProjectPage({ ok: false, reason }))

	expect(response.status).toBe(302)
	expect(response.headers.get("Location")).toBe(location)
})
