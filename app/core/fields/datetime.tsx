import { format, isValid, parseISO } from "date-fns"
import { Input } from "@/ui/components/base/input"
import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * A datetime is an instant, so the zone is not optional: without it the same
 * value means a different moment in every timezone. This is the one part of the
 * contract date-fns cannot state for us — `parseISO` accepts a zoneless
 * `2026-07-14T09:30:00`, and a `format` pattern strict enough to refuse it
 * would need one variant per optional part (seconds, fractional seconds).
 * Everything else about the shape is `parseISO`'s job, which is why every ISO
 * spelling of an instant counts — basic format, week dates and ordinal dates
 * included.
 */
function hasExplicitZone(value: string) {
	return /(Z|[+-]\d{2}:\d{2})$/.test(value)
}

/**
 * A date is shown as a distance from now; a datetime never is, because the time
 * of day is the whole reason the type exists and "3 hours ago" hides it. Both
 * renders therefore say the same thing, and only the panel keeps the stored
 * instant in a tooltip.
 */
function formatDatetime(instant: Date) {
	return format(instant, "MMM d, yyyy, h:mm a")
}

/** An instant, as an ISO-8601 string carrying its zone. */
export const datetimeField: FieldTypeDefFor<"datetime"> = {
	defaultValue: () => "",
	renderControl: ({ disabled, onChange, value }) => (
		<Input
			type="datetime-local"
			step="1"
			value={toDatetimeLocal(value)}
			disabled={disabled}
			onChange={(event) => onChange(fromDatetimeLocal(event.target.value))}
		/>
	),
	renderInline: ({ value }) => {
		const instant = new Date(value as string | number | Date)
		if (Number.isNaN(instant.getTime()))
			return <InlineText>{String(value)}</InlineText>
		return <InlineText>{formatDatetime(instant)}</InlineText>
	},
	renderValue: ({ value }) => {
		const instant = new Date(value as string | number | Date)
		if (Number.isNaN(instant.getTime()))
			return <span className="text-muted-foreground italic">invalid date</span>
		return <span title={String(value)}>{formatDatetime(instant)}</span>
	},
	validate: ({ path, value }) =>
		typeof value === "string" &&
		hasExplicitZone(value) &&
		isValid(parseISO(value))
			? []
			: [`${path} must be a valid date and time`],
}

/**
 * The stored value is a UTC instant, but `datetime-local` speaks only the
 * writer's local wall time, so both directions are converted here. An
 * unparseable value shows an empty picker rather than an invented one.
 *
 * Seconds are carried, with `step="1"` on the control, so that editing a
 * stamped value does not silently round it down to the minute.
 */
function toDatetimeLocal(value: unknown) {
	const date = new Date(String(value ?? ""))
	return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : ""
}

function fromDatetimeLocal(local: string) {
	if (!local) return ""
	const date = new Date(local)
	// A browser without `datetime-local` degrades the control to a text input,
	// so junk is reachable. Hand it back rather than blanking what was typed —
	// the validator names the problem, an empty field would hide it.
	return isValid(date) ? date.toISOString() : local
}
