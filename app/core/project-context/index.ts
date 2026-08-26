/**
 * The Project Context: who the user is, which Project a URL addresses, and what
 * its Config declares — answered once, in one place, for every content route.
 *
 * `requirePageContext` is deliberately not re-exported here. Wiring the module
 * to a request reaches for authentication secrets and a GitHub client, so it
 * lives in `./project-context.server` and server code imports it from there;
 * carrying it through this file would drag both into every browser bundle that
 * only wanted to name a Collection's directory.
 */

export type {
	ConfigResolution,
	ConfigResolver,
	RepositoryAddress,
} from "./config-resolver"
export { createProjectContext } from "./create-project-context"
export { requireCollection, requireSingleton } from "./entities"
export { toPageContext } from "./page-context"
export type {
	PageContext,
	ProjectContextDatabase,
	ProjectContextOk,
	ProjectContextRefusal,
	ProjectContextResult,
	ProjectSession,
	SessionGetter,
} from "./types"
