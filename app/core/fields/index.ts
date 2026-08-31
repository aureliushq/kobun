/**
 * The field-type registry: what each Field Type defaults to, what makes its
 * value valid, how it reads on the page and what the writer edits it with —
 * defined once per type instead of spread across five parallel switches. "How
 * does `date` work?" is answered by opening `date.tsx`.
 *
 * All five behaviors are required of every entry and none may be optional, so a
 * Field Type declared in the config schema without a complete entry fails the
 * build rather than falling through to an empty string at runtime.
 *
 * Callers reach for the dispatcher, never an entry. It asks `roles.tsx` first —
 * a Slug's fixed behavior, and a refusal for a Document, which is the Body and
 * not a value — then looks the Field Type up, and owns everything cross-cutting
 * along the way: the required check, the empty short-circuit, the nesting
 * limits, the dash that stands for nothing filled in, and the callbacks
 * Containers recurse through.
 *
 * The composite row helpers are deliberately not re-exported here. They are the
 * one piece of this module a caller can want without wanting the taxonomy, and
 * this file reaches every entry, and so reaches React. They live in
 * `./composite` and are imported from there.
 */

export {
	defaultForField,
	renderFieldControl,
	renderFieldInline,
	renderFieldValue,
	validateField,
} from "./dispatch"
export { DocumentFieldError, findSlugField, resolveTitleKey } from "./roles"
export type { DefaultForSchema, RenderContext } from "./types"
