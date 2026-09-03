/**
 * The Draft lifecycle: everything about a Draft that needs no round-trip to
 * answer — is it Dirty, where is it edited, what heads its card — plus the
 * vocabulary a caller drives the transitions in.
 *
 * The `createDrafts` factory is deliberately not re-exported here. It parses
 * Sources through a node-only library, so it lives in `./create-drafts.server`
 * and server code imports it from there; carrying it through this file would
 * drag that parser into every browser bundle that only wanted to know whether a
 * Draft is Dirty — which is exactly what the dashboard's draft list wants.
 */
export type { CollectionDraft } from "./collection-drafts"
export { listCollectionDrafts } from "./collection-drafts"
export {
	getCollectionPath,
	getDraftEditorPath,
	isDraftAdoptionNavigation,
} from "./draft-paths"
export type { DraftState } from "./draft-state"
export { draftState, isDraftDirty } from "./draft-state"
export { draftHeading } from "./draft-summary"
export type { DraftRefusal, DraftTarget, SaveInput } from "./types"
