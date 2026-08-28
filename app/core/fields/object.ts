import type { FieldTypeDefFor } from "./types"

/**
 * Named sub-fields — a Container. Its default comes from the injected schema
 * callback rather than from mapping its children here, because defaulting a
 * schema carries Role rules (nested Documents omitted, nested Slugs derived)
 * that no Field Type entry is allowed to know.
 *
 * Validation takes no such callback, deliberately: nested Fields carry no Role
 * rules at all. The metadata module skips a Document only at the top level, and
 * it decided that before this entry was reached. One consequence is a change
 * from the switch this replaced — where the skip was keyed off a falsy path
 * prefix, an object labelled `""` would have had its nested Documents skipped
 * too. That is an accident of an empty string, not a rule, and #70 replaces the
 * path with a loud error, so it is not reproduced here.
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
