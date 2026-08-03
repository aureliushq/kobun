# Candidate 04 — The field type, defined once

**Strength:** Decided · Grilled 2026-07-24 → [ADR 0004](../adr/0004-field-type-registry-excludes-roles.md) · Spec [#68](https://github.com/aureliushq/kobun/issues/68) · Tickets [#69](https://github.com/aureliushq/kobun/issues/69)–[#73](https://github.com/aureliushq/kobun/issues/73) · Sequenced after 01/02.

> One-line: kobun's core vocabulary — the field types — has each type's behavior spread
> across five parallel `switch` statements in four files. A registry keyed by type collapses
> the switches into one lookup; `slug`/`document`/`title` are Roles, not registry entries.

---

## The taxonomy (as decided)

The grilling sharpened the original eleven-type list into **nine Field Types and three Roles**
(now in `CONTEXT.md`):

- **Field Types** (value-carrying): `text · url · date · boolean · image · select · multi_select · array · object` — seven **Scalars**, two **Containers** (`array`, `object`).
- **Roles** (structural assignments, not value kinds): **Slug** (item identity, derived from a
  text field), **Document** (where the Body lives), **Title** (display heading for a container).

The evidence that slug/document were never really field types: the code routes around them
everywhere — skipped in defaults and validation, rendered outside the switch, constrained by
cross-field rules (exactly-one-slug, at-most-one-document, format coupling). Title was a
heuristic (`TITLE_TARGETS` key/label scan) precisely because it had no declared home.

Each Field Type owes **five behaviors** — currently five parallel switches:

| Behavior | Location today | Destination |
|----------|----------------|-------------|
| **Structure / Zod shape** | `packages/config/schema.ts` (per-type `*FieldSchema` + discriminated union) | **Stays** — config layer is React-free, users author against it |
| **Default value** | `collection-metadata.ts` `defaultForField` | registry entry `defaultValue` (ticket #69) |
| **Validation** | `collection-metadata.ts` `validateField` | registry entry `validate` (ticket #69) |
| **Read render** | `singleton.tsx` `FieldValue` + `InlineFieldValue` | registry entries `renderValue` + `renderInline` (ticket #71) |
| **Edit render** | `collection-metadata-fields.tsx` `Control` | registry entry `renderControl` (ticket #72) |

## The decided design

A fields module in the app layer: **one module per Field Type**, a registry assembled under a
`satisfies Record<ValueFieldType, FieldTypeDef>` exhaustiveness check, a **`roles.ts`** for
Slug/Document/Title behavior, and a **dispatcher** whose rule reads as the domain rule:
*roles first, then type lookup.*

Resolutions of the original open questions:

1. **One registry, app-side.** No split registries. Zod schemas stay in `packages/config`
   (React-free, consumed server-side). Adding a type = one schema-union entry + one registry
   entry the compiler demands. Two places, and the second is the user-facing contract — accepted.
2. **Recursion contract: callback injection.** Container entries receive dispatch callbacks
   (`validateChild`, `defaultForChild`; render callbacks on the render context). Entries never
   import the registry — no cycles, and every entry unit-tests with a stub callback. All
   bookkeeping (depth guards, accordion limits, empty-value `—`) lives in the dispatcher only.
3. **What stays out / moves in.** Stays out: cross-field rules (`validateContentSchema`),
   slug derivation, metadata normalization/canonicalization. Moves registry-*side* (not into
   entries): array row descriptors → the `array` module; title detection → `roles.ts` as the
   fallback tier of Title resolution (declared → slug's `from` → heuristic).
4. **Type safety.** Registry keyed by `FieldType` minus the role types, `satisfies`-checked;
   per-entry `field` narrowed to its union variant. A new enum member without an entry fails
   the build. All five behaviors **required** — no optional members; silent fallthrough is the
   bug class this kills. Document reaching the dispatcher is a **loud error** (after a
   call-site audit — nested Documents in objects are a known latent gap to file).
5. **Incremental path.** Five tickets, each deleting the switch it replaces:
   #69 skeleton + default/validate (existing tests pass *unchanged* — the preservation proof) →
   #70 roles + audit + loud Document error → #71 read renderers ∥ #72 edit controls
   (characterization tests first in both) → #73 presentation pull-in.
6. **Payoff.** Funded as a **locality + enforcement** refactor, not extensibility — no field
   type has been added since the taxonomy landed (March 2026). Success metric: "how does
   `date` work?" is one module plus its schema declaration.

Follow-up out of scope: a declarative `title: true` config flag (Title Role surface) — its own
spec later; the heuristic remains as fallback.

## Dependencies / sequencing

- Independent of 01/02/03, but lands **after 01/02** — biggest surface area; frontier ticket is
  [#69](https://github.com/aureliushq/kobun/issues/69).

## Key files

- `packages/config/schema.ts` (field schemas, cross-field rules — stays)
- `app/core/editor/collection-metadata.ts` (`defaultForField`, `validateField` — dissolve into registry)
- `app/routes/singleton.tsx` (`FieldValue`, `InlineFieldValue`, array descriptors, title heuristic — dissolve/relocate)
- `app/core/editor/collection-metadata-fields.tsx` (`Control` — dissolves into registry)
- `packages/config/types.ts` (the `Field` union consumed app-side)
