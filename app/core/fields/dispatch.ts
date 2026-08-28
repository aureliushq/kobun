import type { Field } from "@/config/types"
import { fieldTypeRegistry } from "./registry"
import type { DefaultForSchema, FieldTypeDef, ValueField } from "./types"

/**
 * Slug and Document are Roles, not Field Types (ADR 0004), so they have no
 * registry entry. Today both default to an empty string and validate as text —
 * behavior they inherited from the old switch's `default:` arm rather than
 * chose. #70 lifts this branch into `roles.ts`, where a Document reaching the
 * dispatcher becomes a loud error instead.
 */
function isRole(field: Field): field is Exclude<Field, ValueField> {
	return field.type === "slug" || field.type === "document"
}

/**
 * What counts as nothing filled in. Note an empty object is not empty: a
 * present-but-blank object still owes its required children.
 */
function isEmpty(value: unknown) {
	return (
		value == null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	)
}

/**
 * A registry key and a Field's discriminant are the same string, but TypeScript
 * cannot correlate an indexed access with the union member that produced it.
 * The one cast in the module, and the reason it is worth having in only one
 * place.
 */
function entryFor<F extends ValueField>(field: F): FieldTypeDef<F> {
	return fieldTypeRegistry[field.type] as unknown as FieldTypeDef<F>
}

/**
 * Roles first, then the Field Type. Nothing below this line is a fallthrough:
 * past the Role check the lookup is total over all nine Field Types, and the
 * compiler says so.
 */
export function defaultForField(
	field: Field,
	defaultForSchema: DefaultForSchema,
): unknown {
	if (isRole(field)) return ""
	return entryFor(field).defaultValue({ defaultForSchema, field })
}

/**
 * The required check and the empty short-circuit live here, not in entries:
 * `required` is declared on every Field regardless of type, and the ordering is
 * load-bearing — a required Field that is empty says so and never reaches its
 * type's rules, while an optional empty one is simply left alone.
 *
 * Container entries recurse by being handed this function, which is why no
 * entry ever imports the registry.
 */
export function validateField(
	field: Field,
	value: unknown,
	path: string,
): string[] {
	if (field.required && isEmpty(value)) return [`${path} is required`]
	if (isEmpty(value)) return []
	if (isRole(field))
		return typeof value === "string" ? [] : [`${path} must be text`]
	return entryFor(field).validate({
		field,
		path,
		validateChild: validateField,
		value,
	})
}
