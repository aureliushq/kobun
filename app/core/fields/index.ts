/**
 * The field-type registry: what each Field Type defaults to, what makes its
 * value valid, and how it reads on the page — defined once per type instead of
 * spread across parallel switches. "How does `date` work?" is answered by
 * opening `date.tsx`.
 *
 * Callers reach for the dispatcher, never an entry. It asks `roles.tsx` first —
 * a Slug's fixed behavior, and a refusal for a Document, which is the Body and
 * not a value — then looks the Field Type up, and owns everything cross-cutting
 * along the way: the required check, the empty short-circuit, the nesting
 * limits, the dash that stands for nothing filled in, and the callbacks
 * Containers recurse through. The edit control is the one behavior still
 * decided by a chain inside the dispatcher; #72 dissolves it into the entries.
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
export { ControlRow } from "./presentation"
export { DocumentFieldError, findSlugField, resolveTitleKey } from "./roles"
export type { DefaultForSchema, RenderContext } from "./types"
