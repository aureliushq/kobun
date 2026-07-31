/**
 * The Draft lifecycle: everything about a Draft that a caller holding a Draft
 * row and nothing else can answer — is it Dirty, where is it edited — plus the
 * vocabulary a caller drives the transitions in.
 *
 * The `createDrafts` factory is deliberately not re-exported here. It reaches a
 * database and a repository, so it is imported from `./create-drafts` by server
 * code only; carrying it through this file would drag Drizzle and the source
 * parser into every browser bundle that just wanted to know whether a Draft is
 * Dirty (the dashboard's draft list does exactly that).
 */
export { getCollectionItemEditorPath, getDraftEditorPath } from "./draft-paths"
export { isDraftDirty } from "./draft-state"
export type { DraftRefusal, DraftTarget, SaveInput } from "./types"
