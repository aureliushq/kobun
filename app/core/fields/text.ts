import type { FieldTypeDefFor } from "./types"

/** A line or block of prose. The Scalar every other text-shaped type falls back on. */
export const textField: FieldTypeDefFor<"text"> = {
	defaultValue: ({ field }) => field.defaultValue ?? "",
	validate: ({ path, value }) =>
		typeof value === "string" ? [] : [`${path} must be text`],
}
