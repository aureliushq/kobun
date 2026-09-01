import { afterEach, expect, test } from "vitest"
import { createProjectContext } from "./create-project-context"
import {
	createProjectContextTestHarness,
	type ProjectContextTestHarness,
	TEST_CONFIG,
	TEST_CONFIG_PATH,
	TEST_INSTALLATION_ID,
	TEST_NAME,
	TEST_OWNER,
	TEST_USER_ID,
} from "./test-harness"

let harness: ProjectContextTestHarness

const TARGET = { name: TEST_NAME, owner: TEST_OWNER }

/**
 * A Project that has never had its Config checked, so every test here states
 * what the Config says by describing the repository. When the answer is served
 * from the Project row instead is the cache's business, and its tests'.
 */
function setup() {
	harness = createProjectContextTestHarness()
	return harness
}

afterEach(() => {
	harness?.close()
})

test("refuses an anonymous visitor without asking for a Config", async () => {
	const { configSource, projectContext, setSession } = setup()
	setSession(null)

	expect(await projectContext.resolve(TARGET)).toEqual({
		ok: false,
		reason: "anonymous",
	})
	expect(configSource.calls).toEqual([])
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
	// Still a Project this user may see: the repository was connected, it just
	// declares nothing yet. Refusing it here is what sent a reader back to setup
	// (ADR-0007).
	const { configSource, projectContext } = setup()
	configSource.remove(TEST_CONFIG_PATH)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-missing",
		name: TEST_NAME,
		ok: true,
		owner: TEST_OWNER,
	})
})

test("reports a Config that does not validate", async () => {
	const { configSource, projectContext } = setup()
	configSource.put(TEST_CONFIG_PATH, "{ not a Config")

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-invalid",
		ok: true,
	})
})

test("reports a Config it could not classify at all", async () => {
	// An unreachable repository with nothing cached to fall back on: the module
	// cannot say the Config is missing, only that this Project has none. Every
	// answer that is not "found and parsed" is reported the same way.
	const { configSource, projectContext } = setup()
	configSource.failNext(new Error("API rate limit exceeded"))

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-invalid",
		ok: true,
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

test("resolves the user, the Project, and the installation without asking for a Config", async () => {
	const { configSource, projectContext } = setup()

	const result = await projectContext.resolve(TARGET, { config: false })

	expect(result).toMatchObject({
		installationId: TEST_INSTALLATION_ID,
		name: TEST_NAME,
		ok: true,
		owner: TEST_OWNER,
		session: { user: { id: TEST_USER_ID } },
	})
	expect(result).toHaveProperty("projectRow.id", "project-1")
	expect(result).not.toHaveProperty("config")
	expect(configSource.calls).toEqual([])
})

test("still resolves a Project whose repository has no Config when the Config is skipped", async () => {
	// An image is servable from a repository whose Config was never written, or
	// was deleted this morning. Nothing about the picture depends on it.
	const { configSource, projectContext } = setup()
	configSource.remove(TEST_CONFIG_PATH)

	expect(await projectContext.resolve(TARGET, { config: false })).toMatchObject(
		{ ok: true },
	)
	expect(configSource.calls).toEqual([])
})

test("still resolves a Project whose Config does not validate when the Config is skipped", async () => {
	const { configSource, projectContext } = setup()
	configSource.put(TEST_CONFIG_PATH, "{ not a Config")

	expect(await projectContext.resolve(TARGET, { config: false })).toMatchObject(
		{ ok: true },
	)
	expect(configSource.calls).toEqual([])
})

test("refuses an anonymous visitor when the Config is skipped", async () => {
	// Skipping the Config skips a question, never a check.
	const { projectContext, setSession } = setup()
	setSession(null)

	expect(await projectContext.resolve(TARGET, { config: false })).toEqual({
		ok: false,
		reason: "anonymous",
	})
})

test("refuses a repository the user owns no Project for when the Config is skipped", async () => {
	const { projectContext } = setup()
	const other = { name: "other", owner: TEST_OWNER }

	expect(await projectContext.resolve(other, { config: false })).toEqual({
		ok: false,
		reason: "no-project",
	})
})

test("hands back the session it was given, whole", async () => {
	// The module reads an id off the session and never looks again — so what a
	// caller put in is what it gets out, including the fields the module has no
	// name for. Reading `name` off the answer is the assertion: it compiles.
	const { configSource, db } = setup()
	const session = {
		user: { email: "writer@example.com", id: TEST_USER_ID, name: "Writer" },
	}
	const projectContext = createProjectContext({
		configSource,
		db,
		getSession: async () => session,
	})

	const result = await projectContext.resolve(TARGET)

	expect(result.ok && result.session.user.name).toBe("Writer")
	expect(result.ok && result.session).toBe(session)
})
