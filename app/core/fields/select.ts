import type { FieldTypeDefFor } from "./types"

/** One choice from a declared list. Empty is a value the list need not offer. */
export const selectField: FieldTypeDefFor<"select"> = {
	defaultValue: ({ field }) => field.defaultSelected?.value ?? "",
	validate: ({ field, path, value }) =>
		typeof value === "string" &&
		field.options.some((option) => option.value === value)
			? []
			: [`${path} is not a valid option`],
}
