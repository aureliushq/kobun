import type { Field } from "@/config/types"
import { fieldTypeRegistry } from "./registry"
import { refuseDocument, slugRole } from "./roles"
import type { DefaultForSchema, FieldTypeDef, ValueField } from "./types"

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
 * past the Role check the lookup is total over every Field Type, and the
 * compiler says so.
 */
export function defaultForField(
	field: Field,
	defaultForSchema: DefaultForSchema,
): unknown {
	refuseDocument(field)
	if (field.type === "slug") return slugRole.defaultValue()
	return entryFor(field).defaultValue({ defaultForSchema, field })
}

/**
 * The required check and the empty short-circuit live here, not in entries:
 * `required` is declared on every Field regardless of type, and the ordering is
 * load-bearing — a required Field that is empty says so and never reaches its
 * type's rules, while an optional empty one is simply left alone.
 *
 * The Document refusal sits above both, because it is not a complaint about the
 * value: an empty Document must still be refused, or a call site that forgot to
 * filter one out would be told nothing at all.
 *
 * Container entries recurse by being handed this function, which is why no
 * entry ever imports the registry.
 */
export function validateField(
	field: Field,
	value: unknown,
	path: string,
): string[] {
	refuseDocument(field)
	if (field.required && isEmpty(value)) return [`${path} is required`]
	if (isEmpty(value)) return []
	if (field.type === "slug") return slugRole.validate({ path, value })
	return entryFor(field).validate({
		field,
		path,
		validateChild: validateField,
		value,
	})
}
