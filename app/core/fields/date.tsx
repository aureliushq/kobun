import { isMatch } from "date-fns"
import { usePreferences } from "@/core/preferences/context"
import { formatDate, formatDay, toDate } from "@/core/preferences/dates"
import { InlineText, TextControl } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * Components rather than inline markup, because both readings ask for the
 * writer's Preferences and `renderInline`/`renderValue` are plain functions
 * with early returns — a hook called from one would be a hook called
 * conditionally.
 */
function DateSummary({ value }: { value: unknown }) {
	const preferences = usePreferences()
	const day = toDate(value)
	if (!day) return <InlineText>{String(value)}</InlineText>
	return <InlineText>{formatDay(day, preferences)}</InlineText>
}

function DateValue({ value }: { value: unknown }) {
	const preferences = usePreferences()
	const day = toDate(value)
	if (!day)
		return <span className="text-muted-foreground italic">invalid date</span>
	return <span title={String(value)}>{formatDate(day, preferences)}</span>
}

/**
 * A calendar day, written `yyyy-MM-dd`. The check is the parse: a shape test
 * alone would accept `2026-02-30`, which has the shape and is not a day.
 * Padding is where the parse is lenient — `2026-7-14` is accepted — and that
 * leniency is the contract, not an oversight.
 *
 * Rendering is more forgiving still: whatever a file holds gets shown, and a
 * day nobody can parse says so rather than disappearing. A panel has room for
 * "3 months ago" — or the day itself, if that is what the writer asked for —
 * and keeps the stored day in its tooltip; a one-line summary always spells the
 * day out, because a distance is not something to scan a list by.
 */
export const dateField: FieldTypeDefFor<"date"> = {
	defaultValue: () => "",
	// The browser's own day picker, which is what makes `yyyy-MM-dd` the format
	// without anything here having to say so.
	renderControl: ({ disabled, onChange, value }) => (
		<TextControl
			disabled={disabled}
			onChange={onChange}
			type="date"
			value={value}
		/>
	),
	renderInline: ({ value }) => <DateSummary value={value} />,
	renderValue: ({ value }) => <DateValue value={value} />,
	validate: ({ path, value }) =>
		typeof value === "string" && isMatch(value, "yyyy-MM-dd")
			? []
			: [`${path} must be a valid date`],
}
