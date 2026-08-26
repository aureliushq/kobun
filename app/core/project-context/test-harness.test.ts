import { afterEach, expect, test } from "vitest"
import { ConfigStatus } from "@/db/types"
import {
	createFakeConfigResolver,
	createProjectContextTestHarness,
	type ProjectContextTestHarness,
	TEST_CONFIG,
	TEST_INSTALLATION_ID,
	TEST_NAME,
	TEST_OWNER,
} from "./test-harness"

let harness: ProjectContextTestHarness

afterEach(() => {
	harness?.close()
})

test("seeds a Project the resolver finds", async () => {
	harness = createProjectContextTestHarness()

	expect(
		await harness.projectContext.resolve({
			name: TEST_NAME,
			owner: TEST_OWNER,
		}),
	).toMatchObject({ ok: true })
})

test("seeds another user's Project under enforced foreign keys", () => {
	harness = createProjectContextTestHarness()
	harness.seedUser("user-2")

	expect(() =>
		harness.seedProject({ repoName: "secrets", userId: "user-2" }),
	).not.toThrow()
})

test("refuses to seed a Project for a user who does not exist", () => {
	harness = createProjectContextTestHarness()

	expect(() => harness.seedProject({ userId: "nobody" })).toThrow()
})

test("declares a Config the real validator accepts", () => {
	expect(TEST_CONFIG.basePath).toBe("content")
	expect(Object.keys(TEST_CONFIG.collections)).toEqual(["posts"])
	expect(Object.keys(TEST_CONFIG.singletons)).toEqual(["about"])
	expect(TEST_CONFIG.errors).toEqual([])
})

test("records what the module asked the config resolver for", async () => {
	const configResolver = createFakeConfigResolver()
	const identity = {
		installationId: TEST_INSTALLATION_ID,
		name: TEST_NAME,
		owner: TEST_OWNER,
	}

	expect(await configResolver.resolve(identity)).toEqual({
		config: TEST_CONFIG,
		status: ConfigStatus.PRESENT,
	})
	configResolver.set({ config: null, status: ConfigStatus.MISSING })
	expect(await configResolver.resolve(identity)).toEqual({
		config: null,
		status: ConfigStatus.MISSING,
	})
	expect(configResolver.calls).toEqual([identity, identity])
})
