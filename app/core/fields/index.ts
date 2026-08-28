/**
 * The field-type registry: what each Field Type defaults to and what makes its
 * value valid, defined once per type instead of spread across parallel
 * switches. "How does `date` work?" is answered by opening `date.ts`.
 *
 * Callers reach for the dispatcher, never an entry. It asks `roles.ts` first —
 * a Slug's fixed behavior, and a refusal for a Document, which is the Body and
 * not a value — then looks the Field Type up, and owns everything cross-cutting
 * along the way: the required check, the empty short-circuit, and the callbacks
 * Containers recurse through. Read and edit rendering join the entry contract
 * in #71 and #72.
 *
 * The composite row helpers are deliberately not re-exported here. They are the
 * one piece of this module a caller can want without wanting the taxonomy, and
 * this file reaches every entry — which will mean reaching React once the
 * entries render. They live in `./composite` and are imported from there.
 */

export { defaultForField, validateField } from "./dispatch"
export { DocumentFieldError, findSlugField, resolveTitleKey } from "./roles"
export type { DefaultForSchema } from "./types"
