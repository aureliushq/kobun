import type { FieldTypeDefFor } from "./types"

/**
 * A path to an image in the Project's repository. Held as text and validated as
 * text: whether the path resolves is a question about the repo, not the value.
 */
export const imageField: FieldTypeDefFor<"image"> = {
	defaultValue: () => "",
	validate: ({ path, value }) =>
		typeof value === "string" ? [] : [`${path} must be text`],
}
