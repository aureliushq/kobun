# Candidate 02 — Give "a Content Document" a home

**Strength:** Strong · Do this first or alongside Candidate 01.

**Status: grilled 2026-07-24 — decisions recorded in [ADR 0002](../adr/0002-content-document-fidelity-via-original-raw.md); open questions resolved below.**

> One-line: a repo file is really a **content document** (raw bytes ⇄ `{ frontmatter, body }`,
> keyed by format). That knowledge is scattered across routes and asymmetric — parsing lives
> in 3+ places, serializing in exactly one (md-only). Centralize it into one deep module.

---

## The concept

Every piece of content kobun manages is a file whose bytes encode a document:

- `md` / `mdx` → YAML frontmatter (`gray-matter`) + markdown body.
- `json` → a JSON object (no separate body).
- `yaml` → a YAML object (no separate body).

The mapping **raw string ⇄ `{ data, body }` by format** is the seam. It also carries a
fidelity concern: don't rewrite unchanged frontmatter (whitespace/key-order churn), which
today is handled by a `sourcePrefix` trick — but only for collections.

## Where the logic lives now (scattered + asymmetric)

### Parsing (3+ inline copies)

- **`app/routes/singleton.tsx` L119–135** — the fullest inline parser, branching over all four formats:
  ```ts
  if (format === "md" || "mdx") { const parsed = matter(file.content); data = parsed.data; body = parsed.content }
  else if (format === "json")  { JSON.parse(file.content) ... }
  else if (format === "yaml")  { YAML.parse(file.content) ... }
  ```
  Imports `matter` from `gray-matter` (L4) and `YAML` from `yaml` (L8) directly.
- **`app/routes/collection.tsx` L110–118** — inline `matter(f.content)` while mapping directory files to list rows (md/mdx only). Imports `matter` (L14).
- **`app/core/editor/collection-items.server.ts`** — the _intended_ central module, but md-only:
  - `findCollectionItemBySlug` (L45–80): `matter(file.content)`, `normalizeMetadata`, computes `sourcePrefix = file.content.slice(0, len - parsed.content.length)` (L57).
  - `serializeCollectionItem` (L82–96): re-emits `${sourcePrefix}${markdown}` verbatim unless metadata changed (`canonicalMetadata(a) !== canonicalMetadata(b)`), else `matter.stringify`.
- **`packages/config/validator.ts` L18** — independently `JSON.parse` / `YAML.parse` for the config file (arguably a different document type; decide whether it's in scope).

### Serializing (exactly one place, md-only)

- `serializeCollectionItem` (above) is the only write path. There is **no json/yaml serializer** and **no singleton serializer** anywhere (singleton editor is stubbed).

### The base64 leak

- `packages/github/octokit.server.ts`:
  - `getGithubFileContent` (L234) decodes with `atob(data.content)` (L259) → returns a **binary string**, not UTF-8 bytes.
  - `createOrUpdateGithubTextFile` (L263) encodes with `Buffer.from(content, "utf8").toString("base64")` (L281). Asymmetric with the read side.
- **`app/routes/api.repo-asset.ts` L98–102** — because the wrapper returns `atob` output, the route rebuilds bytes by hand:
  ```ts
  const bin = file.content
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  ```
  A route is coupled to the wrapper's encoding choice.

## Why it's shallow / friction

- **Duplication instead of a module.** "Parse a repo file into `{data, body}`" is written 3+ times, each knowing a different subset of formats.
- **Asymmetry.** Reading understands 4 formats; writing understands 1. When the singleton write path is built, someone re-derives serialization for json/yaml + the `sourcePrefix` trick.
- **No round-trip guarantee.** Nothing asserts `serialize(parse(x)) == x` for unchanged content — the anti-churn behavior is a hopeful string slice, testable only through collections.
- **Deletion test: passes.** The format-branching is irreducible; today it's copy-pasted rather than concentrated.

## The design (grilled 2026-07-24)

A single **Content Document** module at `app/core/content`:

```ts
type ContentDocument = { data: Record<string, unknown>; body: string | null }

parseDocument(raw: string, format: Format): ContentDocument   // throws ContentParseError
serializeDocument(doc: ContentDocument, format: Format, original?: { raw: string }): string
```

- **Fidelity law** (the whole contract, testable): `serializeDocument(parseDocument(raw, f), f, { raw }) === raw`. The module re-parses `original.raw` internally and compares Data canonically — unchanged Data re-emits the original frontmatter block byte-for-byte; changed Data re-stringifies. `sourcePrefix` disappears from `ResolvedCollectionItem` and all callers.
- **Module owns `normalizeMetadata` + `canonicalMetadata`** (both schema-free). `parseDocument` always returns normalized Data — fixes the singleton path leaking YAML `Date` objects. Schema-aware editor logic stays in `collection-metadata.ts`.
- `collection-items.server.ts` shrinks to slug logic; `collection-editor.tsx` serializes via `serializeDocument`.
- **Octokit read fix**: `getGithubFileContent` keeps its `{ content: string }` contract but decodes base64 → UTF-8 correctly (the `atob` path corrupts non-ASCII on every single-file read today — a live bug; the GraphQL directory listing was already correct). New sibling `getGithubFileBytes` returns `Uint8Array`; `api.repo-asset.ts` drops its hand-rolled decode loop.

## Resolved questions

1. **Package boundary** — `app/core/content`; config parsing stays out of scope (read-only, bodyless, no fidelity concern; only two lines of dedup on offer). `Format` is imported from `packages/config`. No `packages/content` until a second consumer actually exists.
2. **json/yaml body** — `body: null` is the contract; `data` is always an object (possibly empty). `serializeDocument` **throws** on a non-null body for a data-only format — silent drop is how a writer loses work. (Config validation already enforces this domain rule: `document` fields require md/mdx.)
3. **Anti-churn primitive** — pass the original raw string; the prefix is derived internally, never exposed. Full CST-level losslessness rejected as unneeded machinery (see ADR 0002).
4. **Normalization** — inside the module (see above).
5. **base64/bytes** — fix text decoding in place + add a separate bytes function. Nothing breaks in `config/github.server.ts` or `singleton.tsx`; both silently stop receiving mojibake.
6. **Round-trip tests** — the agreed test contract:
   1. Round-trip law for all 4 formats × quirky inputs: key order, YAML comments in frontmatter, CRLF, empty frontmatter (`---\n---\n`), absent frontmatter, non-ASCII.
   2. Body changed + Data canonically unchanged → original frontmatter block byte-identical, new body appended.
   3. Data changed → re-stringify per format: md/mdx via `matter.stringify`; json via `JSON.stringify(data, null, "\t") + "\n"` (repo uses tabs); yaml via `yaml` defaults + trailing newline.
   4. Frontmatter date → parsed as `"yyyy-mm-dd"` string; round-trips byte-identical when unchanged.
   5. Data-only format + non-null body → throws.
   6. Malformed input per format → `ContentParseError` (typed, carries format + cause).
   7. md with no frontmatter + Data added on serialize → frontmatter block created.

**Error contract**: `parseDocument` throws `ContentParseError` — a corrupt Source is exceptional, unlike the drafts module's result unions (ADR 0001), which model normal concurrent-editing outcomes. Lenient fallback rejected: data loss beats an error page never.

**Scope**: module **plus all four consumer paths** in one arc — singleton loader, collection list, collection-items, collection-editor serialize, repo-asset. Done means `grep gray-matter app/routes` → 0 hits. History note: `collection-items.server.ts` was also "the intended central module" once; unmigrated call sites are how it became a fourth copy instead of the home.

## Dependencies / sequencing

- **Foundational for Candidate 01** — `publishDraft` serializes through this module.
- Independent of 03 and 04.

## Key files to open in the grill

- `app/routes/singleton.tsx` (L119–135)
- `app/routes/collection.tsx` (L110–118)
- `app/core/editor/collection-items.server.ts` (whole file)
- `app/core/editor/collection-metadata.ts` (`normalizeMetadata`, `canonicalMetadata`)
- `packages/github/octokit.server.ts` (L234–294 — read/write + base64)
- `app/routes/api.repo-asset.ts` (L98–102)
- `packages/config/schema.ts` (`Format` enum, L182–187)
