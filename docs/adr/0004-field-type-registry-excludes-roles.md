---
status: accepted
---

# Field-type registry covers value types only; slug, document, and title are Roles

The behavior of each field type (default, validate, rich render, inline render, edit control) is spread across five parallel switches in four files. We are collapsing them into a registry in `app/core/fields/` — one module per type, assembled with a `satisfies Record<ValueFieldType, FieldTypeDef>` check so a new `FieldType` without an entry fails the build.

The registry covers only the nine value-carrying types (`text · url · date · boolean · image · select · multi_select · array · object`). `slug` and `document` are **Roles** — structural assignments, not value kinds: the code already routes around them everywhere (skipped in defaults and validation, rendered outside the switch, constrained by cross-field rules). Forcing them into the registry would pollute every entry's contract with "unless you're slug or document". They live in a `roles.ts` module beside the registry; the dispatcher checks roles first, then does the type lookup, and a document field reaching the dispatcher is a loud error rather than a silent fallthrough. "Title" is likewise a Role, not a field type — resolution (declared flag, else slug's `from` field, else key/label heuristic) lives in `roles.ts`; a declarative `title: true` config flag is a follow-up.

## Considered Options

- **Zod schemas join the registry** — rejected: `packages/config` is React-free and consumed server-side; the registry needs React. The taxonomy declaration stays in `packages/config/schema.ts` (two places per type, the second being the config contract users author against).
- **`FieldType.TITLE` as a new type** — rejected: value-wise it is `text`; it would break `slug.from`'s must-be-text rule and add a third costume-wearing pseudo-type.
- **Entries import the registry for array/object recursion** — rejected for circular imports; recursive behaviors receive dispatch callbacks instead, and all bookkeeping (depth guards, empty-value rendering) lives in the dispatcher, never in entries.

## Consequences

- All five behaviors are required per entry — no optional members, because silent fallthrough is the bug class this kills.
- Cross-field rules (`validateContentSchema`), slug derivation, and metadata normalization stay outside the registry; array row presentation (`describeArrayField`) and title resolution move to the registry side (`array.tsx` / `roles.ts`).
- Migration is behavior-at-a-time: logic (default + validate) first, then read renderers, then edit controls, then presentation pull-in — after architecture candidates 01/02 land.

## References

- Spec: [#68](https://github.com/aureliushq/kobun/issues/68) · Tickets: [#69](https://github.com/aureliushq/kobun/issues/69) → [#70](https://github.com/aureliushq/kobun/issues/70) → ([#71](https://github.com/aureliushq/kobun/issues/71) ∥ [#72](https://github.com/aureliushq/kobun/issues/72)) → [#73](https://github.com/aureliushq/kobun/issues/73)
- Glossary terms: Field, Field Type, Container, Scalar, Role in `CONTEXT.md`
- Candidate analysis: `docs/architecture/04-field-type-registry.md`
