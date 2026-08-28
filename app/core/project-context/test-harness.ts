import { eq } from "drizzle-orm"
import invariant from "tiny-invariant"
import { validateConfig } from "@/config/validator"
import { githubInstallation, project } from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb } from "@/db/testing"
import { ConfigStatus, type Project, ProjectStatus } from "@/db/types"
import type {
	ConfigSource,
	ConfigSourceRead,
	ConfigSourceRequest,
	RepositoryAddress,
} from "./config-source"
import { createProjectContext } from "./create-project-context"
import type {
	ProjectAccess,
	ProjectContextDatabase,
	ProjectContextOk,
	ProjectSession,
	SessionGetter,
} from "./types"

/**
 * The `Response` a translation threw. Both the page wrapper and the narrowing
 * helpers report themselves by throwing one, so both are asserted the same way.
 */
export function catchResponse(run: () => unknown): Response {
	try {
		run()
	} catch (thrown) {
		if (thrown instanceof Response) return thrown
		throw thrown
	}
	throw new Error("nothing was thrown")
}

export const TEST_CONFIG_PATH = ".kobun.json"
export const TEST_INSTALLATION_ID = "1"
export const TEST_NAME = "blog"
export const TEST_OWNER = "acme"
export const TEST_USER_ID = "user-1"

/**
 * A minimal Config: one Collection and one Singleton. Kept as the source text a
 * repository would hold, so the fake Config source can serve the same bytes the
 * fixture was parsed from.
 */
export const TEST_CONFIG_JSON = JSON.stringify({
	basePath: "content",
	collections: {
		posts: {
			format: "md",
			label: "Posts",
			schema: {
				content: { label: "Content", type: "document" },
				slug: { from: "title", label: "Slug", type: "slug" },
				title: { label: "Title", type: "text" },
			},
		},
	},
	singletons: {
		about: {
			format: "md",
			label: "About",
			schema: {
				content: { label: "Content", type: "document" },
				title: { label: "Title", type: "text" },
			},
		},
	},
	version: 1,
})

/** Parsed through the real validator so the fixture cannot drift from a legal Config. */
export const TEST_CONFIG = (() => {
	const { config } = validateConfig(TEST_CONFIG_JSON, "json")
	invariant(config, "the test Config fixture must be valid")
	return config
})()

/**
 * A resolved Project, as the translations above the resolver see one: only the
 * shape matters, since the resolver's own tests cover its contents.
 */
export const TEST_ACCESS = {
	installationId: TEST_INSTALLATION_ID,
	name: TEST_NAME,
	ok: true,
	owner: TEST_OWNER,
	projectRow: {},
	session: { user: { id: TEST_USER_ID } },
} as unknown as ProjectAccess

/** The same Project, resolved by a caller that wanted its Config too. */
export const TEST_CONTEXT: ProjectContextOk = {
	...TEST_ACCESS,
	config: TEST_CONFIG,
}

export interface FakeConfigSource extends ConfigSource {
	/** Every read the module made, in order. */
	calls: ConfigSourceRequest[]
	/** The next read throws rather than answering — an outage, not a 404. */
	failNext(error: unknown): void
	/** Write a file, as a new revision: its sha and its ETag both change. */
	put(path: string, content: string): void
	remove(path: string): void
}

/**
 * The repository's files, in a Map. Fetching one is somebody else's port — what
 * this module does with the answer, and how rarely it asks, is the subject under
 * test, so the port is faked and the database never is.
 */
export function createFakeConfigSource(
	initial: Record<string, string> = { [TEST_CONFIG_PATH]: TEST_CONFIG_JSON },
): FakeConfigSource {
	const calls: ConfigSourceRequest[] = []
	const files = new Map<
		string,
		{ content: string; etag: string; sha: string }
	>()
	let revisions = 0
	let failure: { error: unknown } | null = null

	function put(path: string, content: string) {
		const revision = ++revisions
		files.set(path, {
			content,
			etag: `"etag-${revision}"`,
			sha: `sha-${revision}`,
		})
	}

	for (const [path, content] of Object.entries(initial)) put(path, content)

	return {
		calls,
		failNext: (error: unknown) => {
			failure = { error }
		},
		put,
		read: async (
			_repository: RepositoryAddress,
			request: ConfigSourceRequest,
		): Promise<ConfigSourceRead> => {
			calls.push(request)

			if (failure) {
				const { error } = failure
				failure = null
				throw error
			}

			const file = files.get(request.path)
			if (!file) return { kind: "not-found" }
			if (request.etag && request.etag === file.etag)
				return { kind: "not-modified" }

			return {
				content: file.content,
				etag: file.etag,
				kind: "content",
				sha: file.sha,
			}
		},
		remove: (path: string) => {
			files.delete(path)
		},
	}
}

export interface SeedProjectValues {
	configCheckedAt?: Date | null
	configData?: string | null
	configError?: string | null
	configEtag?: string | null
	configPath?: string
	configSha?: string | null
	configStatus?: string
	repoId?: string
	repoName?: string
	repoOwnerLogin?: string
	status?: string
	userId?: string
}

export interface ProjectContextTestHarness {
	close(): void
	configSource: FakeConfigSource
	/** The same handle the module holds, so spies on it are seen by the module. */
	db: ProjectContextDatabase
	projectContext: ReturnType<typeof createProjectContext>
	/** The Project row as it now stands — what the cache wrote, and what it left. */
	readProject(id?: string): Project
	/** Another Project, for asserting what the ownership scope excludes. */
	seedProject(values: SeedProjectValues): void
	seedUser(id: string): void
	setSession(session: ProjectSession | null): void
}

/**
 * The real Project and installation schema on in-memory SQLite, with the
 * ownership query and the cache's own row rewrites as the subject under test —
 * so the database is never faked (ADR-0001). The session and the repository's
 * files are, since both are ports.
 *
 * The Project every test starts with is seeded from `values`, so a test about
 * the cache can describe the row it wants — a Project checked a moment ago, one
 * a dashboard sync left an error on — rather than mutating one afterwards.
 */
export function createProjectContextTestHarness(
	values: SeedProjectValues = {},
): ProjectContextTestHarness {
	const { close, db: sqliteDb } = createInMemoryDb()
	let projects = 0

	function seedUser(id: string) {
		sqliteDb
			.insert(user)
			.values({ email: `${id}@example.com`, id, name: "Writer" })
			.run()
	}

	function seedProject(values: SeedProjectValues) {
		sqliteDb
			.insert(project)
			.values({
				configCheckedAt: values.configCheckedAt ?? null,
				configData: values.configData ?? null,
				configError: values.configError ?? null,
				configEtag: values.configEtag ?? null,
				configPath: values.configPath ?? TEST_CONFIG_PATH,
				configSha: values.configSha ?? null,
				configStatus: values.configStatus ?? ConfigStatus.PRESENT,
				id: `project-${++projects}`,
				installationId: "installation-1",
				repoHtmlUrl: "https://github.com/acme/blog",
				repoId: values.repoId ?? String(projects),
				repoName: values.repoName ?? TEST_NAME,
				repoOwnerLogin: values.repoOwnerLogin ?? TEST_OWNER,
				status: values.status ?? ProjectStatus.ACTIVE,
				userId: values.userId ?? TEST_USER_ID,
			})
			.run()
	}

	seedUser(TEST_USER_ID)
	sqliteDb
		.insert(githubInstallation)
		.values({
			githubInstallationId: TEST_INSTALLATION_ID,
			id: "installation-1",
			repositorySelection: "all",
			targetAvatarUrl: "https://example.com/avatar.png",
			targetHtmlUrl: "https://github.com/acme",
			targetId: "1",
			targetLogin: TEST_OWNER,
		})
		.run()
	seedProject(values)

	function readProject(id = "project-1"): Project {
		const row = sqliteDb.select().from(project).where(eq(project.id, id)).get()
		invariant(row, `no Project seeded as ${id}`)
		return row
	}

	// The schema is real and the SQL is the subject under test; only the driver
	// differs from production, so the module keeps its exact D1 type.
	const db = sqliteDb as unknown as ProjectContextDatabase
	const configSource = createFakeConfigSource()
	let session: ProjectSession | null = { user: { id: TEST_USER_ID } }
	const getSession: SessionGetter = async () => session

	return {
		close,
		configSource,
		db,
		projectContext: createProjectContext({ configSource, db, getSession }),
		readProject,
		seedProject,
		seedUser,
		setSession: (next: ProjectSession | null) => {
			session = next
		},
	}
}
