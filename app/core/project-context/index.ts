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

export { lastKnownConfig } from "./config-cache"
export type { RepositoryAddress, SourceRequest } from "./config-source"
export { connectProject } from "./connect-project"
export type { ContentDirectory } from "./entities"
export {
	parentItemStem,
	parentItemTitle,
	requireCollection,
	requireParentItem,
	requireSingleton,
	requireSubcollection,
} from "./entities"
export type { ConfigProblem } from "./types"
