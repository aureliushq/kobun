import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/** A link. Validated by whether the platform's URL parser accepts it, nothing narrower. */
export const urlField: FieldTypeDefFor<"url"> = {
	defaultValue: () => "",
	renderInline: ({ value }) => <InlineText>{String(value)}</InlineText>,
	renderValue: ({ value }) => {
		const href = String(value)
		return (
			<a
				href={href}
				target="_blank"
				rel="noreferrer"
				className="break-all text-primary underline-offset-4 hover:underline"
			>
				{href}
			</a>
		)
	},
	validate: ({ path, value }) => {
		try {
			new URL(String(value))
			return []
		} catch {
			return [`${path} must be a valid URL`]
		}
	},
}
