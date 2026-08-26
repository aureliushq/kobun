import { afterEach, expect, test } from "vitest"
import { ConfigStatus } from "@/db/types"
import {
	createProjectContextTestHarness,
	type ProjectContextTestHarness,
	TEST_CONFIG,
	TEST_INSTALLATION_ID,
	TEST_NAME,
	TEST_OWNER,
	TEST_USER_ID,
} from "./test-harness"

let harness: ProjectContextTestHarness

const TARGET = { name: TEST_NAME, owner: TEST_OWNER }

function setup() {
	harness = createProjectContextTestHarness()
	return harness
}

afterEach(() => {
	harness?.close()
})

test("refuses an anonymous visitor without asking for a Config", async () => {
	const { configResolver, projectContext, setSession } = setup()
	setSession(null)

	expect(await projectContext.resolve(TARGET)).toEqual({
		ok: false,
		reason: "anonymous",
	})
	expect(configResolver.calls).toEqual([])
})

test("refuses a user who has no Project at all", async () => {
	const { projectContext, seedUser, setSession } = setup()
	seedUser("user-2")
	setSession({ user: { id: "user-2" } })

	expect(await projectContext.resolve(TARGET)).toEqual({
		ok: false,
		reason: "no-project",
	})
})

test("refuses a repository someone else holds the Project for", async () => {
	const { projectContext, seedProject, seedUser } = setup()
	// The Project exists, for this exact repository — it is simply not theirs.
	// A query that matched on owner and name alone would hand it over.
	seedUser("user-2")
	seedProject({ repoName: "secrets", userId: "user-2" })

	expect(
		await projectContext.resolve({ name: "secrets", owner: TEST_OWNER }),
	).toEqual({ ok: false, reason: "no-project" })
})

test("refuses a repository the user owns no Project for", async () => {
	const { projectContext } = setup()

	expect(
		await projectContext.resolve({ name: "other", owner: TEST_OWNER }),
	).toEqual({ ok: false, reason: "no-project" })
	expect(
		await projectContext.resolve({ name: TEST_NAME, owner: "someone-else" }),
	).toEqual({ ok: false, reason: "no-project" })
})

test("reports a Config that is not in the repository", async () => {
	const { configResolver, projectContext } = setup()
	configResolver.set({ config: null, status: ConfigStatus.MISSING })

	expect(await projectContext.resolve(TARGET)).toEqual({
		ok: false,
		reason: "config-missing",
	})
})

test("reports a Config that does not validate", async () => {
	const { configResolver, projectContext } = setup()
	configResolver.set({ config: null, status: ConfigStatus.ERROR })

	expect(await projectContext.resolve(TARGET)).toEqual({
		ok: false,
		reason: "config-invalid",
	})
})

test("treats every other Config status as an invalid Config", async () => {
	const { configResolver, projectContext } = setup()

	for (const status of [ConfigStatus.UNKNOWN, ConfigStatus.TOO_LARGE]) {
		configResolver.set({ config: null, status })
		expect(await projectContext.resolve(TARGET)).toEqual({
			ok: false,
			reason: "config-invalid",
		})
	}
})

test("treats a present status without a Config as an invalid Config", async () => {
	const { configResolver, projectContext } = setup()
	configResolver.set({ config: null, status: ConfigStatus.PRESENT })

	expect(await projectContext.resolve(TARGET)).toEqual({
		ok: false,
		reason: "config-invalid",
	})
})

test("resolves the user, the Project, the installation, and the Config", async () => {
	const { projectContext } = setup()

	const result = await projectContext.resolve(TARGET)

	expect(result).toMatchObject({
		config: TEST_CONFIG,
		installationId: TEST_INSTALLATION_ID,
		name: TEST_NAME,
		ok: true,
		owner: TEST_OWNER,
		session: { user: { id: TEST_USER_ID } },
	})
	expect(result).toHaveProperty("projectRow.id", "project-1")
	expect(result).toHaveProperty(
		"projectRow.githubInstallation.githubInstallationId",
		TEST_INSTALLATION_ID,
	)
})
