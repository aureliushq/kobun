import { eq } from "drizzle-orm"
import invariant from "tiny-invariant"
import { afterEach, expect, test } from "vitest"
import { githubInstallation, project } from "@/db/schema/app-schema"
import { ConfigStatus, type Project } from "@/db/types"
import { SetupActionErrors } from "@/ui/lib/types"
import {
	type ConnectableRepository,
	type ConnectProjectResult,
	connectProject,
} from "./connect-project"
import { toProjectPage } from "./page-context"
import {
	createProjectContextTestHarness,
	type ProjectContextTestHarness,
	TEST_CONFIG,
	TEST_CONFIG_PATH,
	TEST_NAME,
	TEST_OWNER,
	TEST_USER_ID,
} from "./test-harness"
import type { ProjectContextDatabase } from "./types"

const INSTALLATION = "installation-1"

/**
 * The installation's repositories: the one the harness already holds a Project
 * for, and one it does not. Connecting the second is the path this ticket is
 * about; connecting the first is the same act run twice.
 */
const REPOS: ConnectableRepository[] = [
	{
		html_url: `https://github.com/${TEST_OWNER}/${TEST_NAME}`,
		id: 1,
		name: TEST_NAME,
		owner: { login: TEST_OWNER },
	},
	{
		html_url: `https://github.com/${TEST_OWNER}/docs`,
		id: 2,
		name: "docs",
		owner: { login: TEST_OWNER },
	},
]

let harness: ProjectContextTestHarness

function setup() {
	harness = createProjectContextTestHarness()
	return harness
}

afterEach(() => {
	harness?.close()
})

/**
 * `syncProjectConfig` as connecting sees it: it goes and looks at the
 * repository and writes what it found onto the row it was handed. What it found
 * is the only thing these tests vary — and it is what decides whether the
 * dashboard the writer is sent to has a Config to render.
 */
function fakeSync(db: ProjectContextDatabase, found: "missing" | "present") {
	const synced: string[] = []

	const columns =
		found === "present"
			? {
					configData: JSON.stringify(TEST_CONFIG),
					configError: "",
					configPath: TEST_CONFIG_PATH,
					configSha: "sha-1",
					configStatus: ConfigStatus.PRESENT,
				}
			: {
					configData: JSON.stringify(null),
					configError: JSON.stringify([
						{
							code: "no_config",
							message: "No configuration file found at repository root.",
							path: "",
						},
					]),
					configPath: TEST_CONFIG_PATH,
					configSha: null,
					configStatus: ConfigStatus.MISSING,
				}

	return {
		syncConfig: async (connected: Project) => {
			synced.push(connected.id)
			await db
				.update(project)
				.set({ ...columns, configCheckedAt: new Date() })
				.where(eq(project.id, connected.id))
		},
		synced,
	}
}

/** The Project a redirect path names, as the dashboard's loader reads it. */
function targetOf(path: string) {
	const [, owner, name] = path.split("/")
	return { name, owner }
}

function connect(
	db: ProjectContextDatabase,
	syncConfig: (connected: Project) => Promise<unknown>,
	repoId: string,
): Promise<ConnectProjectResult> {
	return connectProject(
		{ db, listRepositories: async () => REPOS, syncConfig },
		{ installationId: INSTALLATION, repoId, userId: TEST_USER_ID },
	)
}

test("lands the writer on the dashboard of the repository they connected", async () => {
	const { db, projectContext } = setup()
	const { syncConfig, synced } = fakeSync(db, "present")

	const result = await connect(db, syncConfig, "2")

	expect(result).toEqual({
		ok: true,
		path: `/${TEST_OWNER}/docs`,
		repoName: "docs",
		repoOwnerLogin: TEST_OWNER,
	})
	expect(synced).toHaveLength(1)
	invariant(result.ok, "connecting a granted repository succeeds")

	// The other half of the redirect: the page that path names resolves, without
	// sending the writer anywhere else. The target is read off the path rather
	// than restated, so a redirect that named a repository the lookup cannot
	// find would fail here.
	const resolved = await projectContext.resolve(targetOf(result.path))
	expect(resolved).toMatchObject({ config: TEST_CONFIG, ok: true })
	expect(toProjectPage(resolved)).toBe(resolved)
})

test("lands the writer on the dashboard of a repository that holds no Config", async () => {
	// The regression: setup used to redirect here, and here used to redirect
	// back to setup, so a repository with no Config was connected and then
	// unreachable (ADR-0007).
	const { db, projectContext } = setup()
	const { syncConfig } = fakeSync(db, "missing")

	const result = await connect(db, syncConfig, "2")

	expect(result).toMatchObject({ ok: true, path: `/${TEST_OWNER}/docs` })
	invariant(result.ok, "connecting a granted repository succeeds")

	const resolved = await projectContext.resolve(targetOf(result.path))
	expect(resolved).toMatchObject({
		config: null,
		configProblem: "config-missing",
		ok: true,
	})
	expect(toProjectPage(resolved)).toBe(resolved)
})

test("connecting a repository twice lands on the same Project", async () => {
	const { db, projectContext } = setup()
	const { syncConfig } = fakeSync(db, "present")

	const first = await connect(db, syncConfig, "1")
	const again = await connect(db, syncConfig, "1")

	expect(again).toEqual(first)

	// The unique index is the subject here, so the count comes from the database
	// rather than from what the upsert said it did.
	const rows = await db.query.project.findMany()
	expect(rows).toHaveLength(1)
	expect(rows[0].id).toBe("project-1")

	expect(
		await projectContext.resolve({ name: TEST_NAME, owner: TEST_OWNER }),
	).toMatchObject({ ok: true })
})

test("refuses an installation it does not hold", async () => {
	const { db } = setup()
	const { syncConfig, synced } = fakeSync(db, "present")

	const result = await connectProject(
		{ db, listRepositories: async () => REPOS, syncConfig },
		{ installationId: "installation-2", repoId: "2", userId: TEST_USER_ID },
	)

	expect(result).toEqual({
		error: SetupActionErrors.INSTALLATION_NOT_FOUND,
		ok: false,
	})
	expect(synced).toEqual([])
})

test("refuses an installation that has been suspended", async () => {
	const { db } = setup()
	const { syncConfig } = fakeSync(db, "present")
	await db
		.update(githubInstallation)
		.set({ suspendedAt: new Date() })
		.where(eq(githubInstallation.id, INSTALLATION))

	expect(await connect(db, syncConfig, "2")).toEqual({
		error: SetupActionErrors.INSTALLATION_SUSPENDED,
		ok: false,
	})
})

test("refuses a repository the installation does not grant", async () => {
	const { db } = setup()
	const { syncConfig } = fakeSync(db, "present")

	expect(await connect(db, syncConfig, "99")).toEqual({
		error: SetupActionErrors.REPO_NOT_FOUND,
		ok: false,
	})

	expect(await db.query.project.findMany()).toHaveLength(1)
})
