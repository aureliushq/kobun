# Candidate 03 — One way in: the authenticated repo context

**Strength:** Worth exploring · Do after 01/02; partly mechanical.

> One-line: every content route repeats the same ~30-line auth → project → config preamble
> (and the ownership check has already drifted). Promote the existing private
> `resolveCollectionContext` into a shared **RepoContext** seam — and let it own the config
> cache decision that the hot path currently ignores.

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

## Proposed deepening (starting point — grill this)

Promote `resolveCollectionContext` to a shared seam:

```ts
requireRepoContext(args, opts?) → {
  session, project, projectRow, installationId, config, env, db,
  owner, name,
}
// plus thin helpers that narrow to a specific entity:
requireCollection(ctx, slug) → collection
requireSingleton(ctx, slug) → singleton
```

- Owns the config-cache decision: read `project.configData` when `configSha` is fresh, fall
  back to `fetchAndParseConfig` (and opportunistically refresh the cache).
- Callers choose the failure mode (redirect for pages, 401/404 for APIs) via `opts`, so
  `api.repo-asset` can adopt it without changing behavior.

## Open questions for the grilling session

1. **Redirect vs. throw** — pages redirect (`PATHS.LOGIN`/`PATHS.SETUP`), APIs return status codes. One seam with a mode flag, or two thin wrappers over a shared core?
2. **What's in the returned context?** Superset of all callers' needs, or minimal + per-route follow-up queries? (Interacts with Candidate 01's `ctx`.)
3. **Config cache correctness** — when is `configData` stale? Trust `configSha` vs. always revalidate? What invalidates it (webhook? TTL? the dashboard sync)? Is stale config a correctness bug (renders wrong schema) or just cosmetic?
4. **`findMany`+`.find` vs `findFirst`** — the read routes fetch all projects then filter in JS; the editor uses a scoped `findFirst`. Standardize on the scoped query?
5. **Layouts** — do `dashboard.tsx`/`editor.tsx` share the same seam, or is loader-level config a separate concern from layout-level?
6. **Does this seam belong in the Draft module's `ctx`** (Candidate 01) or is it a layer below both routes and Draft?

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
