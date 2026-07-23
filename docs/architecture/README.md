# Architecture deepening candidates

Output of the `/improve-codebase-architecture` review (2026-07-23) over the `feat/editor`
hot spot. Each candidate turns a **shallow** module (interface nearly as complex as its
implementation, or logic smeared inline through routes) into a **deep** one — testable and
AI-navigable.

Shared vocabulary: **module · interface · depth · seam · adapter · leverage · locality**,
plus the **deletion test** ("would deleting this concentrate complexity, or just move it?").
See the `/codebase-design` skill.

Each file below is self-contained. Take one into a fresh `/grilling` session.

| # | Candidate | Strength | Grill file |
|---|-----------|----------|------------|
| 01 | **Draft lifecycle** — extract the working-copy state machine out of `collection-editor.tsx` | Strong | [01-draft-lifecycle.md](./01-draft-lifecycle.md) |
| 02 | **Content Document** — one home for format ⇄ `{ frontmatter, body }` | Strong | [02-content-document.md](./02-content-document.md) |
| 03 | **Repo context seam** — one way into auth + project + config | Worth exploring | [03-repo-context-seam.md](./03-repo-context-seam.md) |
| 04 | **Field-type registry** — define each field type once | Speculative | [04-field-type-registry.md](./04-field-type-registry.md) |

## Recommended sequence

1. **02 (Content Document)** first or alongside — it's the seam 01 sits on top of.
2. **01 (Draft lifecycle)** — the top recommendation; deepest hidden complexity, unblocks the stubbed singleton editor.
3. **03 (Repo context seam)** — mechanical once 01/02 land; also fixes the per-request config re-fetch.
4. **04 (Field-type registry)** — largest blast radius; attempt last, after the extraction rhythm is proven.

## Notes that apply to all candidates

- No `CONTEXT.md` or ADRs exist yet. As a deepened module gets named (e.g. _Draft_,
  _Content Document_), add the term to `CONTEXT.md` via `/domain-modeling`. None of these
  candidates contradict an existing ADR (there are none).
- The singleton **write** path is currently stubbed (`app/routes/singleton-editor.tsx`,
  `app/routes/singleton-item-editor.tsx` — both `// TODO: implement`). Several candidates
  are partly motivated by _not_ cloning collection logic when that stub is filled in.
- Only two real modules exist on the write path today: `packages/github/octokit.server.ts`
  (text + base64 primitives) and `app/core/editor/collection-items.server.ts` (md-only
  serialize/parse). Everything else the routes do inline.
