# Candidate 01 — The Draft is a lifecycle, not a table

**Strength:** Strong · **Top recommendation — start here**

> One-line: the draft ↔ published reconciliation state machine (optimistic concurrency
> against GitHub) lives entirely inline in a route's `loader` + `action`. Extract it into a
> deep **Draft** module so the concurrency logic becomes unit-testable and the stubbed
> singleton editor can reuse it.

---

## The concept that has no home

kobun keeps an editable **draft** of a collection item in D1 (`editorDraft` table) while the
canonical content is a file committed to GitHub. The genuinely hard part is reconciling the
two: revisions, optimistic-concurrency guards, 409 conflicts, rebasing a clean draft when the
GitHub file moved underneath it, syncing after publish, and deleting a draft once its body
matches source again.

Today that logic is **smeared across a route file**. The file that _looks_ like the draft
module — `app/core/editor/drafts.ts` — holds only three one-line pure predicates.

## Where the logic actually lives (current state)

### `app/routes/collection-editor.tsx` (922 lines — the offender)

- **`resolveCollectionContext` (L54–110)** — auth + project + config preamble (see Candidate 03).
- **`loader` (L156–265)** — draft resolution + **rebase**:
  - New mode (L160–206): mint a draft row (`crypto.randomUUID`), `applyMetadataDefaults`, insert, redirect with `?draft=`.
  - Item mode (L208–265): find existing draft; if `!isDraftDirty(draft) && draft.sourceSha !== item.sha`, **rebase** the clean draft to the new GitHub content with an optimistic-concurrency `UPDATE ... WHERE revision = ... AND publishedRevision = ...` (L217–246).
- **`readActionPayload` (L275–299)** — validates the POST body shape.
- **`saveDraft` (L301–389)** — the SAVE path. Insert-or-update `editorDraft` with the revision guard `.where(... eq(editorDraft.revision, payload.expectedRevision))` (L349); returns 409 `"Draft changed in another session"` on mismatch; short-circuits when nothing changed (L329–336, using `canonicalMetadata`).
- **`deleteSyncedDraft` (L391–407)** — delete guarded on `revision === publishedRevision`.
- **`action` (L409–633)** — the ~220-line orchestration:
  - No-op detection when body+metadata already match source (L423–451).
  - `saveDraft` (L452).
  - On PUBLISH: `validateMetadata` (L461), required-document check (L465–472), slug validation (L473–478), duplicate-slug scan across the directory (L484–496), stale-sha 409 (L500–509), draft-deletion-when-clean path (L511–539), the GitHub commit via `createOrUpdateGithubTextFile` + `serializeCollectionItem` (L541–559), post-publish **sync** update (L574–596), fallback sync when the guarded update misses (L598–622), and final `deleteSyncedDraft` (L623).

### `app/core/editor/drafts.ts` (42 lines — the shallow "module")

Pure, tiny, and the _only_ extracted draft logic:
- `isDraftDirty(draft)` — `publishedRevision === null || revision > publishedRevision`.
- `isPublishedDraftSynced(draft)` — `publishedAt != null && revision === publishedRevision`.
- `getDraftEditorPath(draft, project)` — URL builder.

### Client side (context, not the target)

- `packages/editor/hooks/use-autosave.ts` — pure debounce hook; calls `persistence.onAutoSave/onPublish` (adapter contract in `packages/editor/types.ts:18`).
- `collection-editor.tsx` `sendAction` (L672–724) — serializes the fetch to `/api/editor...`, threads `expectedRevision` via a `revisionRef`, queues mutations (`mutationQueueRef`).
- Metadata-only autosave: a second 1s `setTimeout` (L791–805).

### Schema

- `packages/db/schema/app-schema.ts` — `editorDraft` table. Columns that drive the machine: `revision`, `publishedRevision`, `sourcePath`, `sourceSha`, `publishedAt`, `itemSlug`, `collectionSlug`, `projectId`, `markdown`, `metadata`.

## Why it's shallow / friction

- **No locality.** The rules for "dirty / synced / rebase / delete" are split between three tiny predicates in `drafts.ts` and hundreds of lines of inline SQL in the route. To understand one transition you bounce between files.
- **The interface is not the test surface.** The only way to exercise the concurrency logic (409s, stale sha, rebase, post-publish sync) is to drive the HTTP `action` against real D1 + real GitHub. There are no unit tests for the state machine because there is no unit to test.
- **Deletion test: passes strongly.** Deleting the inline logic would force the same state machine back into a route. It concentrates irreducible complexity.
- **Duplication is imminent.** The singleton editor is stubbed (`singleton-editor.tsx` / `singleton-item-editor.tsx`). Filling it in today means cloning ~400 lines of this.

## Proposed deepening (starting point — grill this)

A deep **Draft** module (working title `EditorSession` / `DraftStore`) that owns the
transitions behind a small interface. Rough shape:

```ts
// owns editorDraft + reconciliation against a committed source
openDraft(ctx, { mode, slug, draftId })  → { draftId, revision, initialContent, initialFields, ... }
saveDraft(ctx, { draftId, expectedRevision, markdown, fields }) → { draftId, revision } | Conflict
publishDraft(ctx, { draftId, expectedRevision, markdown, fields }) → { commitSha, editorPath, ... } | Conflict | ValidationError
```

The route becomes a thin adapter: `readActionPayload` → call one method → `Response.json`.
The 409/422 results become typed return values, not thrown `Response`s buried in the middle
of the function.

### State machine (currently implicit)

```
[*] --> New         : openDraft(new)
[*] --> Loaded      : openDraft(existing)
Loaded --> Rebased  : source sha moved & draft clean
New/Loaded/Rebased --> Dirty : saveDraft (revision+1, optimistic guard → 409)
Dirty --> Published : publishDraft → commit → sync
Published --> Deleted : body matches source
```

## Decisions (grilled 2026-07-24)

All open questions below were resolved in a grilling session. The load-bearing decision — the module owns the publish commit behind a `SourceStore` port, with outcomes as typed result unions — is recorded as [ADR-0001](../adr/0001-drafts-module-owns-publish-via-sourcestore-port.md).

1. **Seam shape** — a factory, `createDrafts({db, sourceStore, project, collection, collectionSlug, directoryPath})`, built once per request, returning `{open, save, publish}`. GitHub identity (`env`, `installationId`, `owner`, `name`) is absorbed into the `SourceStore` adapter's closure — the drafts module never sees it.
2. **GitHub boundary** — the module owns the commit, through an injected narrow **`SourceStore`** port (`list`, `write(path, content, expectedSha)`); production adapter wraps `createOrUpdateGithubTextFile` / `listGithubDirectoryFiles`. The full commit → sync → fallback-sync → delete chain stays inside one testable unit.
3. **Validation** — `publish` owns all gates (metadata, slug regex, required document, duplicate-slug scan). `serializeCollectionItem` is called as-is behind the boundary; Candidate 02 later deepens it *inside* the seam.
4. **Errors** — typed result unions: `{ok: false, code: 'revision-conflict' | 'stale-source' | 'duplicate-slug' | 'validation' | 'not-found'}`. The route owns a single code → HTTP status map. Throwing is reserved for genuine bugs.
5. **`drafts.ts` fate** — folded in as the module's pure core; `isDraftDirty` and `getDraftEditorPath` stay exported (dashboard uses them). `isPublishedDraftSynced` is deleted (only its own test uses it).
6. **`open` scope** — owns mint, rebase (including the re-read fallback), and the dirty-vs-clean **effective content** decision. Redirects and view-model shaping stay in the route.
7. **Singleton generality** — core transitions take a resolved `source` (`{path, sha, body, frontmatter} | null`), not a slug; slug resolution + duplicate gate are a collection-specific layer inside the module. No `SourceLocator` strategy until the singleton editor exists.
8. **Naming** — module `app/core/editor/drafts/`, factory `createDrafts`, glossary noun **Draft** (see root `CONTEXT.md`).
9. **Sequencing** — 01 ships first, standalone, against today's serializer. Candidate 02 becomes an internal refactor of the module.
10. **Tests** — Drizzle over in-memory `better-sqlite3` with the real `editorDraft` schema (the `UPDATE ... WHERE` guard semantics *are* the subject under test) + a Map-backed fake `SourceStore`. Cases: revision-conflict on save, no-op short-circuit, first-save insert, unique-race conflict, mint, rebase, rebase race → re-read, dirty-not-rebased, effective content both ways, all publish refusals, publish → sync → delete, the never-before-exercised fallback-sync branch, and delete-when-body-matches.

## Open questions for the grilling session

1. **Where does the seam go?** A pure function over injected `db`/`github`, or a class holding `ctx`? What exactly is in `ctx` (db, env, installationId, owner, name, collection, projectRow)? (Overlaps Candidate 03.)
2. **Does the Draft module call GitHub directly, or return a "please commit this" intent** that the route executes? I.e. is `publishDraft` responsible for the commit, or does it hand back a serialized document + path? This decides testability (mock GitHub vs. no GitHub).
3. **Validation ownership** — does `publishDraft` own `validateMetadata` + slug + duplicate-scan, or does that stay in the route? (Argues for pulling Candidate 02's serialization in too.)
4. **Conflicts as values vs. exceptions** — return a `{ ok: false, conflict }` union, or keep throwing `Response`? What's the cleanest test assertion?
5. **How much does `drafts.ts` survive?** Fold the three predicates into the new module, or keep them as the module's pure core?
6. **Singleton reuse** — is the abstraction general over "content item + source file", so singletons drop in? Singletons have no slug/directory listing — does that break the interface, or just parameterize it?
7. **What tests do we want to exist after?** Enumerate the concurrency cases we can't test today: stale-sha 409 on save, rebase of clean draft, publish → sync → delete, duplicate-slug rejection, no-op short-circuit.

## Dependencies / sequencing

- Sits **on top of** Candidate 02 (Content Document) — `publishDraft` serializes through it. Do 02 first or in the same session.
- Overlaps Candidate 03 (Repo context) for what `ctx` contains — but 01 can proceed with the existing private `resolveCollectionContext` and adopt the shared seam later.

## Key files to open in the grill

- `app/routes/collection-editor.tsx` (L156–633 especially)
- `app/core/editor/drafts.ts`
- `app/core/editor/collection-items.server.ts` (`serializeCollectionItem`, `findCollectionItemBySlug`)
- `app/core/editor/collection-metadata.ts` (`canonicalMetadata`, `validateMetadata`, `getSlugField`)
- `packages/db/schema/app-schema.ts` (`editorDraft`)
- `packages/github/octokit.server.ts` (`createOrUpdateGithubTextFile`)
