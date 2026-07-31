/**
 * The Draft lifecycle: everything about a Draft that a caller holding a Draft
 * row and nothing else can answer — is it Dirty, where is it edited — plus the
 * vocabulary a caller drives the transitions in.
 *
 * The `createDrafts` factory is deliberately not re-exported here. It parses
 * Sources through a node-only library, so it lives in `./create-drafts.server`
 * and server code imports it from there; carrying it through this file would
 * drag that parser into every browser bundle that only wanted to know whether a
 * Draft is Dirty — which is exactly what the dashboard's draft list wants.
 */
export { getCollectionItemEditorPath, getDraftEditorPath } from "./draft-paths"
export { isDraftDirty } from "./draft-state"
export type { DraftRefusal, DraftTarget, SaveInput } from "./types"
