# Candidate 03 — One way in: the authenticated project context

**Strength:** Worth exploring · Do after 01/02; partly mechanical.
**Status:** Grilled 2026-07-24 — all open questions resolved; design settled below. Cache policy recorded as [ADR 0003](../adr/0003-config-served-from-d1-cache-with-ttl-revalidation.md); `Project` and `Config` added to `CONTEXT.md`.

> One-line: every content route repeats the same ~30-line auth → project → config preamble
> (and the ownership check has already drifted). Promote the existing private
> `resolveCollectionContext` into a shared **ProjectContext** seam — and let it own the
> config cache decision that the hot path currently ignores.

---

## The repeated ritual

Each content route opens by resolving the same thing: _who is the user, do they own this
repo, what's the installation, and what does the kobun config say?_

### The copies

- **`app/routes/singleton.tsx` L62–96** — `getAuth` → `getSession` → redirect `PATHS.LOGIN` if anon → `db.query.project.findMany` + `.find(p => owner/name)` → redirect `PATHS.SETUP` if none → `installationId` → `fetchAndParseConfig` → `config.singletons[slug]` + invariants.
- **`app/routes/collection.tsx` L63–97** — same shape, ending in `config.collections[slug]`.
- **`app/routes/collection-editor.tsx` L54–110** — already extracted **privately** as `resolveCollectionContext`; uses `findFirst` with a combined `where` (owner+name+userId), throws `Response` 404/422 instead of redirecting. Returns a rich object (`collection, db, env, installationId, directoryPath, projectRow, ...`).
- **`app/routes/api.repo-asset.ts` L29–61** — auth + ownership only (no config). **Drifted**: phrases ownership as `findFirst({ where: and(userId, repoOwnerLogin, repoName) })` and returns `401`/`404` (different from the others' redirects).
- Layouts also fetch config: `app/core/components/layouts/dashboard.tsx:42`, `editor.tsx:42`.

> "One adapter is a hypothetical seam; two is a real one." Here there are four+.

## The second smell hiding inside: two config representations

- **Live path (used by every route):** `packages/config/github.server.ts` `fetchAndParseConfig` (L26) hits GitHub (`getGithubFileContent` over `CONFIG_PATHS`) and re-runs Zod `validateConfig` on **every** navigation to a collection/singleton/editor page.
- **Cached path (written, never read on hot path):** `syncProjectConfig` (L72) writes a parsed `configData` JSON blob + `configSha` + `configStatus` into the D1 `project` row (`app-schema.ts`). Only `app/routes/api.dashboard-actions.ts:47` populates it, and **no content route reads it back**.

So config is fetched + validated from GitHub redundantly on the hot path while a cache sits unused.

## Why it's shallow / friction

- **Leverage.** Auth + ownership + config resolution is touched by literally every route. Fixing it once fixes it everywhere.
- **Locality of the security check.** "Does this user own this repo?" is copy-pasted and has _already drifted_ (`api.repo-asset` differs). A single seam removes a class of authz bugs.
- **Deletion test: moderate.** Thinner than 01/02 — it mostly _moves_ complexity rather than concentrating deep logic. The strength here is leverage + the config-cache fix, not depth. That's why it's "Worth exploring," not "Strong."

## Settled design (grilled 2026-07-24)

The domain noun is **Project**, not repo — "repo" stays GitHub-side vocabulary, the same way
ADR 0001's `SourceStore` absorbs GitHub identity. The seam lives in
`app/core/project-context/` alongside all of its policy; `packages/config` keeps
`fetchAndParseConfig` as the dumb fetch it is.

```ts
// core resolver — returns a discriminated union, never throws:
resolveProjectContext(args, opts?: { config?: false })
  → { ok: true, session, projectRow, installationId, config, configStatus, owner, name, db, env }
  | { ok: false, reason: "anonymous" | "no-project" | "config-missing" | "config-invalid" }

// thin translators own the HTTP map (mirrors ADR 0001's typed-results philosophy):
requirePageContext(args, opts?)  // redirects: anonymous → PATHS.LOGIN, others → PATHS.SETUP
requireApiContext(args, opts?)   // throws Response: 401 / 404 / 422

// pure narrowing helpers derive entity + paths; not part of the core:
requireCollection(ctx, slug) → { collection, directoryPath }
requireSingleton(ctx, slug)  → { singleton, filePath }
```

Decisions, one per original open question:

1. **Redirect vs. throw** → typed-union core + two thin wrappers. No mode flag; the core
   never encodes HTTP policy.
2. **Returned context** → repo-level facts only (above). Entity narrowing is separate
   helpers; editor-only rules (md/mdx-only) stay in the editor route on top of
   `requireCollection`. `{ config: false }` skips config resolution entirely (and narrows
   the return type) — `api.repo-asset` serves images without ever touching config, even
   past the cache TTL.
3. **Config cache** → serve `configData` when `configCheckedAt` is within ~60s; past the
   TTL, conditionally re-fetch only the cached `configPath` (ETag/sha) and opportunistically
   rewrite the row. Negative results (`MISSING`/`ERROR`) cache under the same TTL; a 404 at
   the cached path falls back to the full `CONFIG_PATHS` probe (config renames). There is no
   webhook, so the TTL *is* the staleness bound. Full trade-off record: ADR 0003.
4. **Query shape** → scoped `findFirst` (`userId + repoOwnerLogin + repoName` in the WHERE)
   everywhere; the `findMany`+JS-filter shape dies. Callers that genuinely need the full
   project list (dashboard's repo switcher) own that as a separate query.
5. **Layouts** → both layouts adopt `requirePageContext`. The layout/route double-resolve
   per navigation becomes harmless: within the TTL the second resolve is a D1 row read, not
   a GitHub call.
6. **Relation to the Draft module** → a layer above drafts, below route handlers — the
   composition root's helper. Drafts never sees it; routes use its output to construct the
   `SourceStore` adapter. ADR 0001 stays intact.

**Route mapping** (one deliberate behavior change): `singleton`, `collection`, and
`collection-editor` all use the page wrapper — the editor's 404-on-no-project drift becomes
a SETUP redirect, on the theory that hitting an editor URL for a repo you don't own should
land you where every other page does. `api.repo-asset` uses the API wrapper with unchanged
behavior.

**Implementation note:** two parallel loaders (layout + child route) can both cross the TTL
and race the opportunistic row rewrite. Last-write-wins on identical data is benign, but the
rewrite must not clobber a concurrent dashboard sync's richer update (sync also writes
`configError`/`status`).

## Dependencies / sequencing

- Best **after** 01/02 so the `ctx` shape is informed by what the Draft module needs.
- Independent of 04.

## Key files to open in the grill

- `app/routes/singleton.tsx` (L62–96)
- `app/routes/collection.tsx` (L63–97)
- `app/routes/collection-editor.tsx` (`resolveCollectionContext`, L54–110)
- `app/routes/api.repo-asset.ts` (L29–61)
- `packages/config/github.server.ts` (`fetchAndParseConfig` L26, `syncProjectConfig` L72, `deriveConfigStatus` L19)
- `packages/db/schema/app-schema.ts` (`project` columns: `configData`, `configSha`, `configStatus`, `configCheckedAt`)
- `app/routes/api.dashboard-actions.ts` (L47 — the only cache writer)
