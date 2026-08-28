import type { FieldTypeDefFor } from "./types"

/** A link. Validated by whether the platform's URL parser accepts it, nothing narrower. */
export const urlField: FieldTypeDefFor<"url"> = {
	defaultValue: () => "",
	validate: ({ path, value }) => {
		try {
			new URL(String(value))
			return []
		} catch {
			return [`${path} must be a valid URL`]
		}
	},
}
