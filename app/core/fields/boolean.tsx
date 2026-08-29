import { Badge } from "@/ui/components/base/badge"
import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * Frontmatter round-trips a flag as the string `"true"` often enough that both
 * spellings have to read the same. Anything else is false — including the
 * string `"false"`, which is the point.
 */
function isTruthy(value: unknown) {
	return value === true || value === "true"
}

/** A flag. Absent means false, never undefined — the editor always has something to show. */
export const booleanField: FieldTypeDefFor<"boolean"> = {
	defaultValue: ({ field }) => field.defaultValue ?? false,
	renderInline: ({ value }) => (
		<InlineText>{isTruthy(value) ? "True" : "False"}</InlineText>
	),
	renderValue: ({ value }) => (
		<Badge
			variant="outline"
			className={
				isTruthy(value)
					? "border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400"
					: "border-muted-foreground/30 bg-muted text-muted-foreground"
			}
		>
			{isTruthy(value) ? "true" : "false"}
		</Badge>
	),
	validate: ({ path, value }) =>
		typeof value === "boolean" ? [] : [`${path} must be a boolean`],
}
