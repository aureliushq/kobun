import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { NormalizedConfig } from "@/config/types"
import type * as schema from "@/db/schema"
import type { ProjectWithGithubInstallation } from "@/db/types"
import type { InstallationID } from "@/types/github"

/**
 * Production runs on D1; tests run the same schema on in-memory SQLite and cast
 * to this type. The cast holds as long as the module sticks to plain queries:
 * never call `.batch()` or `.transaction()`, which differ between the drivers.
 */
export type ProjectContextDatabase = DrizzleD1Database<typeof schema>

/**
 * The session, as the module sees it: someone with an id to scope a Project
 * query by. Everything else an authentication provider knows about a user is
 * the caller's business, so nothing here names one.
 */
export interface ProjectSession {
	user: { id: string }
}

/** Who is asking. Resolves to null for an anonymous visitor. */
export type SessionGetter = () => Promise<ProjectSession | null>

/**
 * Why a Project Context could not be resolved. Each reason is a normal outcome
 * — an anonymous visitor and a mistyped repository name are both things users
 * do — so they are reported, never thrown (ADR-0001). Translating them into
 * redirects or statuses is the wrapper's job.
 */
export type ProjectContextRefusal =
	| "anonymous"
	| "config-invalid"
	| "config-missing"
	| "no-project"

/**
 * Everything a content route needs before it can address any content: who the
 * user is, which Project this is, and what its Config declares. Repository-level
 * facts only — narrowing to a Collection or a Singleton is a separate helper.
 */
export interface ProjectContextOk {
	config: NormalizedConfig
	installationId: InstallationID
	name: string
	ok: true
	owner: string
	projectRow: ProjectWithGithubInstallation
	session: ProjectSession
}

export type ProjectContextResult =
	| ProjectContextOk
	| { ok: false; reason: ProjectContextRefusal }

/**
 * What a page loader holds after the wrapper has translated every refusal: the
 * context, plus the two request-scoped handles routes reach for afterwards. The
 * core resolver has `db` injected and never sees `env` at all; both are attached
 * out here, where a request actually exists.
 */
export interface PageContext extends ProjectContextOk {
	db: ProjectContextDatabase
	env: Env
}
