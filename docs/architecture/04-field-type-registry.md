# Candidate 04 — The field type, defined once

**Strength:** Speculative · Attempt last, after 01/02 prove the extraction rhythm.

> One-line: kobun's core vocabulary — the field types — has each type's behavior spread
> across five parallel `switch` statements in four files. Adding a field type means editing
> all five, and the compiler forces none of them to stay in sync. A registry keyed by type
> would collapse the switches into one lookup.

---

## The taxonomy

The field types are the domain's ubiquitous language:
`text · slug · url · date · boolean · image · select · multi_select · array · object · document`.
(Canonical `FieldType` enum: `packages/config/schema.ts` L9–21.)

Each type needs five behaviors — and each behavior is its own switch in its own file:

| Behavior | Location | Shape |
|----------|----------|-------|
| **Structure / Zod shape** | `packages/config/schema.ts` L93–169 | one `*FieldSchema` per type + discriminated union `fieldSchema` (L144) |
| **Default value** | `app/core/editor/collection-metadata.ts` `defaultForField` L33–50 | `switch (field.type)` |
| **Validation** | `app/core/editor/collection-metadata.ts` `validateField` L134–191 | `switch (field.type)` (recurses for array/object) |
| **Read render** | `app/routes/singleton.tsx` `FieldValue` L501–571 (+ `InlineFieldValue` L575–626) | `switch (field.type)` → per-type view components |
| **Edit render** | `app/core/editor/collection-metadata-fields.tsx` `Control` L21–222 | `if (field.type === ...)` chain → per-type inputs |

Plus cross-field rules in `schema.ts` `validateContentSchema` (L189–285): "exactly one slug
field", "format must be md/mdx when a document field exists", "at most one document field",
`slug.from` must reference a text field, `defaultSelected` must be a valid option.

## Why it's shallow / friction

- **No locality.** Everything about `date` is in five places: `dateFieldSchema`, the
  `defaultForField` default (`""`), the `validateField` regex `^\d{4}-\d{2}-\d{2}$`, the
  `DateValue`/`InlineFieldValue` renderers, and the `input type="date"` control. Understanding
  one field type is a scavenger hunt.
- **No compiler enforcement.** Adding `"color"` means remembering to touch all five sites.
  Miss one and you get a silent runtime fallthrough (`default: return ""` / `JsonFallback`).
- **AI-navigability.** "How does image work?" should be one file, not four.
- **Deletion test: passes for the taxonomy** — but the interface is genuinely hard (see caveat).

## Why only Speculative (read this before grilling)

- Read-render, edit-render, and validate **genuinely differ** — they aren't accidental
  duplication. A registry has to host three real, unlike behaviors per entry.
- **Recursion.** `array`/`object` nest other fields; renderers recurse with depth/accordion
  context (`singleton.tsx` `RenderCtx`, `MAX_RENDER_DEPTH`). The registry interface must pass
  a recursion callback cleanly, which is where naive designs get ugly.
- **Large blast radius** across the two most complex files (`singleton.tsx` 1128 lines,
  `collection-metadata-fields.tsx` 264 lines).
- The read side (`singleton.tsx`) also has a lot of _presentation_ logic (title detection,
  array-row schema descriptors L234–338) that is **not** per-type behavior and should stay put.

Attempt only after Candidates 01/02 establish the team's extraction rhythm.

## Proposed deepening (starting point — grill this)

A **field-type registry** keyed by type, each entry bundling the behaviors:

```ts
interface FieldTypeDef<F> {
  schema: ZodType<F>
  defaultValue(field: F): unknown
  validate(field: F, value: unknown, path: string, recurse): string[]
  renderValue(field: F, value: unknown, ctx): ReactNode   // read
  renderControl(field: F, value: unknown, onChange, ctx): ReactNode  // edit
}
const fieldTypes: Record<FieldType, FieldTypeDef<any>> = { text: {...}, date: {...}, ... }
```

The five switches become `fieldTypes[field.type].xxx(...)`. A new field type is one entry
the type system can force to be complete.

## Open questions for the grilling session

1. **Is one registry entry too much per type**, or should we split into e.g. a validation
   registry and a rendering registry (server vs. client bundles — `singleton.tsx` render is
   server-ish, `Control` is client)? Watch the client/server boundary.
2. **Recursion contract** — how do `array`/`object` entries call back into the registry
   without circular-import pain? Pass a `renderField`/`validateField` callback into each entry?
3. **What stays out** — confirm title detection, `describeArrayField`, `RenderCtx`/depth
   guards, and cross-field `validateContentSchema` rules are _not_ per-type and remain where
   they are.
4. **Type safety** — can we get exhaustiveness (every `FieldType` has an entry) enforced at
   compile time, and per-entry `field` narrowed to its variant?
5. **Incremental path** — can we migrate one behavior at a time (e.g. `defaultForField` first,
   then `validate`, then renderers) so it's not one giant PR?
6. **Payoff sizing** — how often do new field types actually get added? If rarely, is the
   registry worth the interface cost, or is the real win just AI-navigability/locality?

## Dependencies / sequencing

- Independent of 01/02/03, but **do it last** — biggest surface area, subtlest interface.

## Key files to open in the grill

- `packages/config/schema.ts` (L9–169 field schemas, L189–285 cross-field rules)
- `app/core/editor/collection-metadata.ts` (`defaultForField` L33, `validateField` L134)
- `app/routes/singleton.tsx` (`FieldValue` L501, `InlineFieldValue` L575; note L234–338 is NOT per-type)
- `app/core/editor/collection-metadata-fields.tsx` (`Control` L21)
- `packages/config/types.ts` (the `Field` union consumed app-side)
