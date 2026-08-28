import type { FieldTypeDefFor } from "./types"

/** A flag. Absent means false, never undefined — the editor always has something to show. */
export const booleanField: FieldTypeDefFor<"boolean"> = {
	defaultValue: ({ field }) => field.defaultValue ?? false,
	validate: ({ path, value }) =>
		typeof value === "boolean" ? [] : [`${path} must be a boolean`],
}
