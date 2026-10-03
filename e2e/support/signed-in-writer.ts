import { readFileSync } from "node:fs"
import { parse } from "@dotenvx/dotenvx"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { testUtils } from "better-auth/plugins"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import glob from "fast-glob"
import { validateConfig } from "@/config/validator"
import * as schema from "@/db/schema"
import { githubInstallation, project } from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { ConfigStatus, ProjectStatus } from "@/db/types"

export const E2E_OWNER = "kobun-e2e"
export const E2E_NAME = "blog"

const USER_ID = "e2e-writer"
const INSTALLATION_ID = "e2e-installation"

const CONFIG = JSON.stringify({
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
	version: 1,
})

/** The version a Config cache row must be parsed by to be served. */
const KOBUN_VERSION = JSON.parse(readFileSync("package.json", "utf8")).version

/** The local D1 the dev server's Miniflare keeps, as `db:setup` left it. */
function localDatabase() {
	const [path] = glob.sync("./.wrangler/state/v3/d1/**/*.sqlite", {
		ignore: ["**/metadata.sqlite"],
	})
	if (!path) throw new Error("No local D1 database: run `bun run db:setup`")
	return new Database(path)
}

/**
 * The secret the dev server signs sessions with: `.dev.vars` when there is one,
 * otherwise none, which leaves both instances on Better Auth's default.
 */
function serverSecret() {
	try {
		return parse(readFileSync(".dev.vars", "utf8")).BETTER_AUTH_SECRET
	} catch {
		return undefined
	}
}

/**
 * A writer with one Project, straight into the local D1 the dev server reads,
 * and a session cookie for them. The Config is cached as just checked, so the
 * editor resolves it without asking GitHub; called before each test, it stays
 * inside the cache's window. Sign-in is GitHub's alone, so the session is
 * minted by Better Auth's own test helpers rather than through the app.
 */
export async function signInWriter(baseURL: string) {
	const sqlite = localDatabase()
	const db = drizzle(sqlite, { casing: "snake_case", schema })
	try {
		db.insert(user)
			.values({ email: "e2e@example.com", id: USER_ID, name: "E2E Writer" })
			.onConflictDoNothing()
			.run()
		db.insert(githubInstallation)
			.values({
				githubInstallationId: "0",
				id: INSTALLATION_ID,
				repositorySelection: "all",
				targetAvatarUrl: "https://example.com/avatar.png",
				targetHtmlUrl: `https://github.com/${E2E_OWNER}`,
				targetId: "0",
				targetLogin: E2E_OWNER,
			})
			.onConflictDoNothing()
			.run()
		const cached = {
			configCheckedAt: new Date(),
			configData: JSON.stringify(validateConfig(CONFIG, "json").config),
			configParsedBy: KOBUN_VERSION,
			configStatus: ConfigStatus.PRESENT,
		}
		db.insert(project)
			.values({
				...cached,
				configPath: ".kobun.json",
				id: "e2e-project",
				installationId: INSTALLATION_ID,
				repoHtmlUrl: `https://github.com/${E2E_OWNER}/${E2E_NAME}`,
				repoId: "0",
				repoName: E2E_NAME,
				repoOwnerLogin: E2E_OWNER,
				status: ProjectStatus.ACTIVE,
				userId: USER_ID,
			})
			.onConflictDoUpdate({ set: cached, target: project.id })
			.run()

		const auth = betterAuth({
			baseURL,
			database: drizzleAdapter(db, { provider: "sqlite", schema }),
			plugins: [testUtils()],
			secret: serverSecret(),
		})
		const { cookies } = await (await auth.$context).test.login({
			userId: USER_ID,
		})
		return cookies.map(({ name, value }) => ({ name, url: baseURL, value }))
	} finally {
		sqlite.close()
	}
}
