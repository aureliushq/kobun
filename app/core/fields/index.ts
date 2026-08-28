/**
 * The field-type registry: what each Field Type defaults to and what makes its
 * value valid, defined once per type instead of spread across parallel
 * switches. "How does `date` work?" is answered by opening `date.ts`.
 *
 * Callers reach for the dispatcher, never an entry. It checks Roles first, then
 * looks the Field Type up, and owns everything cross-cutting — the required
 * check, the empty short-circuit, and the callbacks Containers recurse through.
 * Read and edit rendering join the entry contract in #71 and #72.
 */

export { getCompositeValue, setCompositeValue } from "./composite"
export { defaultForField, validateField } from "./dispatch"
export type {
	DefaultContext,
	DefaultForSchema,
	FieldOfType,
	FieldTypeDef,
	FieldTypeDefFor,
	ValidateChild,
	ValidateContext,
	ValueField,
	ValueFieldType,
} from "./types"
