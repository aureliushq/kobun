/**
 * The Project Context: who the user is, which Project a URL addresses, and what
 * its Config declares — answered once, in one place, for every content route.
 *
 * The wrappers that wire the module to a request — `requirePageContext` and
 * `requireApiAccess` — are deliberately not re-exported here. Wiring reaches
 * for authentication secrets and a GitHub client, so they live in
 * `./project-context.server` and server code imports them from there; carrying
 * them through this file would drag both into every browser bundle that only
 * wanted to name a Collection's directory.
 */

export { toApiContext } from "./api-context"
export type {
	ConfigSource,
	ConfigSourceRead,
	ConfigSourceRequest,
	RepositoryAddress,
} from "./config-source"
export { createProjectContext } from "./create-project-context"
export { requireCollection, requireSingleton } from "./entities"
export { toPageContext } from "./page-context"
export type {
	ApiAccessContext,
	PageContext,
	ProjectAccess,
	ProjectAccessResult,
	ProjectContextDatabase,
	ProjectContextOk,
	ProjectContextRefusal,
	ProjectContextResult,
	ProjectSession,
	ProjectTarget,
	RefusedProjectContext,
	SessionGetter,
	SkipConfig,
} from "./types"
