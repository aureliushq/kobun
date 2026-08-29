import { formatDistanceToNow, isMatch } from "date-fns"
import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * A calendar day, written `yyyy-MM-dd`. The check is the parse: a shape test
 * alone would accept `2026-02-30`, which has the shape and is not a day.
 * Padding is where the parse is lenient — `2026-7-14` is accepted — and that
 * leniency is the contract, not an oversight.
 *
 * Rendering is more forgiving still: whatever a file holds gets shown, and a
 * day nobody can parse says so rather than disappearing. A panel has room for
 * "3 months ago" and keeps the stored day in its tooltip; a one-line summary
 * spells the day out, because a distance is not something to scan a list by.
 */
export const dateField: FieldTypeDefFor<"date"> = {
	defaultValue: () => "",
	renderInline: ({ value }) => {
		const day = new Date(value as string | number | Date)
		if (Number.isNaN(day.getTime()))
			return <InlineText>{String(value)}</InlineText>
		return (
			<InlineText>
				{day.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				})}
			</InlineText>
		)
	},
	renderValue: ({ value }) => {
		const day = new Date(value as string | number | Date)
		if (Number.isNaN(day.getTime()))
			return <span className="text-muted-foreground italic">invalid date</span>
		return (
			<span title={String(value)}>
				{formatDistanceToNow(day, { addSuffix: true })}
			</span>
		)
	},
	validate: ({ path, value }) =>
		typeof value === "string" && isMatch(value, "yyyy-MM-dd")
			? []
			: [`${path} must be a valid date`],
}
