import type { FieldTypeDefFor } from "./types"

/**
 * Any number of choices from a declared list. Two failures worth telling apart:
 * a value that is not a list of strings at all, and a list holding something the
 * schema never offered.
 */
export const multiSelectField: FieldTypeDefFor<"multi_select"> = {
	defaultValue: ({ field }) =>
		field.defaultSelected?.map(({ value }) => value) ?? [],
	validate: ({ field, path, value }) => {
		if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
			return [`${path} must be a list of options`]
		const options = new Set(field.options.map(({ value }) => value))
		return value.every((item) => options.has(item))
			? []
			: [`${path} contains an invalid option`]
	},
}
