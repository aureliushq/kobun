import { Badge } from "@/ui/components/base/badge"
import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * What a stored value is called. A value the list no longer offers is shown
 * as-is rather than hidden: the file says it, so the page says it too.
 *
 * Exported for `multi_select`, which is this type in the plural and asks the
 * same question of every choice.
 */
export function optionLabel(
	options: { label: string; value: string }[],
	value: unknown,
): string {
	const match = options.find((option) => option.value === String(value))
	return match ? match.label : String(value)
}

/** One choice from a declared list. Empty is a value the list need not offer. */
export const selectField: FieldTypeDefFor<"select"> = {
	defaultValue: ({ field }) => field.defaultSelected?.value ?? "",
	renderInline: ({ field, value }) => (
		<InlineText>{optionLabel(field.options, value)}</InlineText>
	),
	renderValue: ({ field, value }) => (
		<Badge variant="outline">{optionLabel(field.options, value)}</Badge>
	),
	validate: ({ field, path, value }) =>
		typeof value === "string" &&
		field.options.some((option) => option.value === value)
			? []
			: [`${path} is not a valid option`],
}
