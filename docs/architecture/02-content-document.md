# Candidate 02 — Give "a Content Document" a home

**Strength:** Strong · Do this first or alongside Candidate 01.

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

## Proposed deepening (starting point — grill this)

A single **Content Document** module (working title `packages/content` or `app/core/content`):

```ts
type ContentDocument = { data: Record<string, unknown>; body: string | null }

parseDocument(raw: string, format: Format): ContentDocument
serializeDocument(doc: ContentDocument, format: Format, original?: { raw: string }): string
```

- Absorbs the `sourcePrefix` "don't churn unchanged frontmatter" behavior for **all** formats that have frontmatter, generalized from `collection-items.server.ts`.
- `collection-items.server.ts` becomes a thin caller (keeps its collection-specific slug logic, delegates parse/serialize).
- Add a **bytes-safe read** to the octokit wrapper (e.g. return a `Uint8Array` or expose a `getGithubBinaryFile`) so `api.repo-asset.ts` stops hand-decoding.

## Open questions for the grilling session

1. **Package boundary** — `packages/content` (shared, importable by config too) or `app/core/content` (app-only)? Does config's YAML/JSON parsing belong in the same module or stay separate?
2. **Do `json`/`yaml` documents have a body?** Today they don't (data only). Is `body: null` the contract, or do we reserve a convention?
3. **Anti-churn generalization** — is `sourcePrefix` (a raw-string slice) the right primitive, or do we model it as `{ raw, parsed }` so serialize can compare structurally? What exactly is the fidelity guarantee we promise?
4. **Where does `normalizeMetadata` / `canonicalMetadata` sit** relative to this module — inside it, or does the module stay dumb about metadata semantics and leave normalization to the caller?
5. **base64/bytes** — change `getGithubFileContent` to return bytes and decode text at call sites, or add a separate binary read? What breaks in `config/github.server.ts` and `singleton.tsx` if the read contract changes?
6. **Round-trip tests** — enumerate: parse→serialize unchanged = byte-identical; metadata change re-emits via `matter.stringify`; each format's empty/edge cases.

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
