import type { FieldTypeDefFor } from "./types"

/**
 * Named sub-fields — a Container. Its default comes from the injected schema
 * callback rather than from mapping its children here, because defaulting a
 * schema carries Role rules (nested Documents omitted, nested Slugs derived)
 * that no Field Type entry is allowed to know.
 */
export const objectField: FieldTypeDefFor<"object"> = {
	defaultValue: ({ defaultForSchema, field }) => defaultForSchema(field.fields),
	validate: ({ field, path, validateChild, value }) => {
		if (!value || typeof value !== "object" || Array.isArray(value))
			return [`${path} must be an object`]
		const record = value as Record<string, unknown>
		return Object.entries(field.fields).flatMap(([key, child]) =>
			validateChild(child, record[key], `${path}.${child.label}`),
		)
	},
}
