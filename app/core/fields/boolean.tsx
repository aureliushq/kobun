import { Badge } from "@/ui/components/base/badge"
import { Checkbox } from "@/ui/components/base/checkbox"
import { Switch } from "@/ui/components/base/switch"
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
	// A checkbox unless the schema asked for a switch. Both read the value
	// strictly — only `true` is checked, so a half-written file shows unchecked
	// rather than checked-because-non-empty.
	renderControl: ({ disabled, field, onChange, value }) =>
		field.componentType === "switch" ? (
			<Switch
				checked={value === true}
				disabled={disabled}
				onCheckedChange={onChange}
			/>
		) : (
			<Checkbox
				checked={value === true}
				disabled={disabled}
				onCheckedChange={(checked) => onChange(checked === true)}
			/>
		),
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
