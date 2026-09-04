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
 * The least a session can be and still answer the module's only question about
 * one: an id to scope a Project query by. Everything else an authentication
 * provider knows about a user is the caller's business — which is why the types
 * below are generic over the session rather than naming its fields. A caller
 * hands in whatever its provider returns and gets the same thing back, with the
 * module having read nothing from it but the id.
 */
export interface ProjectSession {
	user: { id: string }
}

/** Who is asking. Resolves to null for an anonymous visitor. */
export type SessionGetter<TSession extends ProjectSession = ProjectSession> =
	() => Promise<TSession | null>

/**
 * Why a Project Context could not be resolved. Each reason is a normal outcome
 * — an anonymous visitor and a mistyped repository name are both things users
 * do — so they are reported, never thrown (ADR-0001). Translating them into
 * redirects or statuses is the wrapper's job.
 *
 * A Config that is missing or will not validate is not among them: that is an
 * answer about a Project the caller may see, not a reason it cannot (ADR-0007).
 */
export type ProjectContextRefusal = "anonymous" | "no-project"

/**
 * What is wrong with the Config of a Project the user may see. Reported on the
 * success arm below rather than as a refusal, because a repository with no
 * Config is still a repository this user connected — and its dashboard is where
 * it says so.
 *
 * `config-unreadable` is the third thing, and not a kind of invalid: an
 * unreachable repository says nothing about the file in it, so a Project whose
 * Config is fine must not be reported as broken during a blip (ADR-0003).
 */
export type ConfigProblem =
	| "config-invalid"
	| "config-missing"
	| "config-unreadable"

/**
 * Who is asking and which Project they mean: the access question, answered
 * without asking what the Project declares. Everything a caller needs to reach
 * into the repository — and everything it needs to be allowed to.
 */
export interface ProjectAccess<
	TSession extends ProjectSession = ProjectSession,
> {
	installationId: InstallationID
	name: string
	ok: true
	owner: string
	projectRow: ProjectWithGithubInstallation
	session: TSession
}

/**
 * Everything a content route needs before it can address any content: the
 * access above, plus what the Project's Config declares. Repository-level facts
 * only — narrowing to a Collection or a Singleton is a separate helper.
 */
export interface ProjectContextOk<
	TSession extends ProjectSession = ProjectSession,
> extends ProjectAccess<TSession> {
	config: NormalizedConfig
}

/**
 * The same access, over a Project whose Config could not be resolved. It
 * carries what was already resolved rather than collapsing to a bare reason, so
 * a caller can both say what is wrong and say where to send the reader — the
 * dashboard of the Project it just named.
 */
export interface UnconfiguredProjectContext<
	TSession extends ProjectSession = ProjectSession,
> extends ProjectAccess<TSession> {
	config: null
	configProblem: ConfigProblem
}

/**
 * The other arm, named so the two can be spoken about apart. Not
 * `ProjectContextRefusal`, which is the reason a context was refused rather
 * than the refusal itself.
 */
export interface RefusedProjectContext {
	ok: false
	reason: ProjectContextRefusal
}

/**
 * What the resolver answers a caller that asked for a Config. `config` is the
 * discriminant between the first two arms: `null` is a unit type, so
 * `if (result.config)` narrows to the Project that has one.
 */
export type ProjectContextResult<
	TSession extends ProjectSession = ProjectSession,
> =
	| ProjectContextOk<TSession>
	| UnconfiguredProjectContext<TSession>
	| RefusedProjectContext

/** The same answer from a caller that skipped the Config. */
export type ProjectAccessResult<
	TSession extends ProjectSession = ProjectSession,
> = ProjectAccess<TSession> | RefusedProjectContext

/** Which repository is being asked about. */
export interface ProjectTarget {
	name: string
	owner: string
}

/**
 * The one option the resolver takes. `{ config: false }` answers who is asking
 * and which Project they mean, and stops: an asset request has no use for a
 * Config, and past the cache's window resolving one would put a GitHub
 * round-trip in front of a picture. The narrower success type is half the
 * point — a Config nobody asked for is a Config nobody can read.
 */
export interface SkipConfig {
	config: false
}

/**
 * The two request-scoped handles routes reach for after a wrapper has answered.
 * The core resolver has `db` injected and never sees `env` at all; both are
 * attached out here, where a request actually exists.
 */
export interface RequestHandles {
	db: ProjectContextDatabase
	env: Env
}

/** What a page loader holds once every refusal has become a redirect. */
export interface PageContext<TSession extends ProjectSession = ProjectSession>
	extends ProjectContextOk<TSession>,
		RequestHandles {}

/**
 * What the Project's own pages hold: the same thing, except that a Config it
 * could not resolve is something to render rather than somewhere to go. Only
 * the dashboard reads this — every page that addresses content still needs a
 * Config, and takes `PageContext`.
 */
export type ProjectPageContext<
	TSession extends ProjectSession = ProjectSession,
> = (ProjectContextOk<TSession> | UnconfiguredProjectContext<TSession>) &
	RequestHandles

/** What an API route holds once every refusal has become a status. */
export interface ApiAccessContext<
	TSession extends ProjectSession = ProjectSession,
> extends ProjectAccess<TSession>,
		RequestHandles {}
