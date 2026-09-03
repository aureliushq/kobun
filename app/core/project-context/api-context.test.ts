import { expect, test } from "vitest"
import { toApiContext } from "./api-context"
import { catchResponse, TEST_ACCESS, TEST_CONTEXT } from "./test-harness"
import type { ProjectContextRefusal } from "./types"

function responseFor(reason: ProjectContextRefusal): Response {
	return catchResponse(() => toApiContext({ ok: false, reason }))
}

test.each<[ProjectContextRefusal, number, string]>([
	["anonymous", 401, "Unauthorized"],
	["no-project", 404, "Not Found"],
])("turns %s into a %i an API consumer can act on", async (reason, status, body) => {
	const response = responseFor(reason)

	expect(response.status).toBe(status)
	expect(await response.text()).toBe(body)
})

test("hands a resolved context straight through", () => {
	expect(toApiContext(TEST_CONTEXT)).toBe(TEST_CONTEXT)
})

test("hands a resolution that skipped the Config straight through", () => {
	expect(toApiContext(TEST_ACCESS)).toBe(TEST_ACCESS)
})

test("keeps the Config off a resolution that skipped it", () => {
	// The claim is about the type, so `bun run check:types` is what proves it:
	// were a Config still on this shape, the expectation below would compile and
	// the unused suppression would fail the build.
	const access = toApiContext(TEST_ACCESS)

	// @ts-expect-error a caller that never asked for a Config cannot read one
	expect(access.config).toBeUndefined()
})
