import invariant from "tiny-invariant"
import { validateConfig } from "@/config/validator"
import { githubInstallation, project } from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb } from "@/db/testing"
import { ConfigStatus, ProjectStatus } from "@/db/types"
import type {
	ConfigResolution,
	ConfigResolver,
	RepositoryAddress,
} from "./config-resolver"
import { createProjectContext } from "./create-project-context"
import type {
	ProjectContextDatabase,
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

export const TEST_INSTALLATION_ID = "1"
export const TEST_NAME = "blog"
export const TEST_OWNER = "acme"
export const TEST_USER_ID = "user-1"

/**
 * A minimal Config: one Collection and one Singleton. Parsed through the real
 * validator so the fixture cannot drift from a legal Config.
 */
export const TEST_CONFIG = (() => {
	const { config } = validateConfig(
		JSON.stringify({
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
		}),
		"json",
	)
	invariant(config, "the test Config fixture must be valid")
	return config
})()

export interface FakeConfigResolver extends ConfigResolver {
	/** Every repository the module asked about, in order. */
	calls: RepositoryAddress[]
	/** What the next resolution reports. */
	set(resolution: ConfigResolution): void
}

/**
 * A Config the test dictates. Fetching one is somebody else's port — what this
 * module does with the answer is the subject under test, so the answer is faked
 * and the database never is.
 */
export function createFakeConfigResolver(
	initial: ConfigResolution = {
		config: TEST_CONFIG,
		status: ConfigStatus.PRESENT,
	},
): FakeConfigResolver {
	let resolution = initial
	const calls: RepositoryAddress[] = []

	return {
		calls,
		resolve: async (repository: RepositoryAddress) => {
			calls.push(repository)
			return resolution
		},
		set: (next: ConfigResolution) => {
			resolution = next
		},
	}
}

export interface SeedProjectValues {
	repoId?: string
	repoName?: string
	repoOwnerLogin?: string
	userId?: string
}

export interface ProjectContextTestHarness {
	close(): void
	configResolver: FakeConfigResolver
	/** The same handle the module holds, so spies on it are seen by the module. */
	db: ProjectContextDatabase
	projectContext: ReturnType<typeof createProjectContext>
	/** Another Project, for asserting what the ownership scope excludes. */
	seedProject(values: SeedProjectValues): void
	seedUser(id: string): void
	setSession(session: ProjectSession | null): void
}

/**
 * The real Project and installation schema on in-memory SQLite, with the
 * ownership query as the subject under test — so the database is never faked
 * (ADR-0001). The session and the Config are, since both are ports.
 */
export function createProjectContextTestHarness(): ProjectContextTestHarness {
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
				configPath: ".kobun.json",
				configStatus: ConfigStatus.PRESENT,
				id: `project-${++projects}`,
				installationId: "installation-1",
				repoHtmlUrl: "https://github.com/acme/blog",
				repoId: values.repoId ?? String(projects),
				repoName: values.repoName ?? TEST_NAME,
				repoOwnerLogin: values.repoOwnerLogin ?? TEST_OWNER,
				status: ProjectStatus.ACTIVE,
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
	seedProject({})

	// The schema is real and the SQL is the subject under test; only the driver
	// differs from production, so the module keeps its exact D1 type.
	const db = sqliteDb as unknown as ProjectContextDatabase
	const configResolver = createFakeConfigResolver()
	let session: ProjectSession | null = { user: { id: TEST_USER_ID } }
	const getSession: SessionGetter = async () => session

	return {
		close,
		configResolver,
		db,
		projectContext: createProjectContext({ configResolver, db, getSession }),
		seedProject,
		seedUser,
		setSession: (next: ProjectSession | null) => {
			session = next
		},
	}
}
