import { isValid, parseISO } from "date-fns"
import { usePreferences } from "@/core/preferences/context"
import {
	formatDatetime,
	formatDatetimeWithZone,
	fromWallTime,
	resolvedTimezone,
	toDate,
	toWallTime,
} from "@/core/preferences/dates"
import type { UserPreferenceValues } from "@/db/types"
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
 * renders therefore say the same thing, and both hang the clock it is read on
 * off it in a tooltip, since no label names a zone. The panel has room for the
 * second fact too: the instant as the file holds it, in the zone it was
 * stamped in.
 *
 * Components rather than inline markup, so the Preferences can be read at the
 * top of a render rather than after `renderInline`'s early return.
 */
function DatetimeSummary({ value }: { value: unknown }) {
	const preferences = usePreferences()
	const instant = toDate(value)
	if (!instant) return <InlineText>{String(value)}</InlineText>
	return (
		<InlineText title={formatDatetimeWithZone(instant, preferences)}>
			{formatDatetime(instant, preferences)}
		</InlineText>
	)
}

function DatetimeValue({ value }: { value: unknown }) {
	const preferences = usePreferences()
	const instant = toDate(value)
	if (!instant)
		return <span className="text-muted-foreground italic">invalid date</span>
	return (
		<span
			title={`${formatDatetimeWithZone(instant, preferences)} · ${String(value)}`}
		>
			{formatDatetime(instant, preferences)}
		</span>
	)
}

function DatetimeControl({
	disabled,
	onChange,
	value,
}: {
	disabled?: boolean
	onChange(next: unknown): void
	value: unknown
}) {
	const { timezone } = usePreferences()
	return (
		<Input
			type="datetime-local"
			step="1"
			title={`Read and written on the ${resolvedTimezone(timezone)} clock.`}
			value={toDatetimeLocal(value, timezone)}
			disabled={disabled}
			onChange={(event) =>
				onChange(fromDatetimeLocal(event.target.value, timezone))
			}
		/>
	)
}

/** An instant, as an ISO-8601 string carrying its zone. */
export const datetimeField: FieldTypeDefFor<"datetime"> = {
	defaultValue: () => "",
	renderControl: ({ disabled, onChange, value }) => (
		<DatetimeControl disabled={disabled} onChange={onChange} value={value} />
	),
	renderInline: ({ value }) => <DatetimeSummary value={value} />,
	renderValue: ({ value }) => <DatetimeValue value={value} />,
	validate: ({ path, value }) =>
		typeof value === "string" &&
		hasExplicitZone(value) &&
		isValid(parseISO(value))
			? []
			: [`${path} must be a valid date and time`],
}

/**
 * The stored value is an instant, but `datetime-local` speaks only wall time,
 * so both directions are converted here. An unparseable value shows an empty
 * picker rather than an invented one.
 *
 * Which clock's wall time is the timezone Preference's answer, and its absence
 * means the machine's — the browser conversion this control has always done. A
 * writer who states a zone reads and writes the same instant the same way from
 * any laptop they open.
 *
 * This is the closest the Preferences come to ADR-0010's line, since the same
 * typed reading now commits a different instant under a different zone. It
 * stays the right side of it: the zone was always deciding that, the browser's
 * silently, and both spellings commit the moment the writer meant. What a
 * Commit writes is the instant, and the instant is unchanged — only the clock
 * the writer read it off is now one they chose.
 *
 * Seconds are carried, with `step="1"` on the control, so that editing a
 * stamped value does not silently round it down to the minute.
 */
function toDatetimeLocal(
	value: unknown,
	timezone: UserPreferenceValues["timezone"],
) {
	const instant = toDate(String(value ?? ""))
	return instant ? toWallTime(instant, timezone) : ""
}

function fromDatetimeLocal(
	local: string,
	timezone: UserPreferenceValues["timezone"],
) {
	if (!local) return ""
	const date = fromWallTime(local, timezone)
	// A browser without `datetime-local` degrades the control to a text input,
	// so junk is reachable. Hand it back rather than blanking what was typed —
	// the validator names the problem, an empty field would hide it.
	return isValid(date) ? date.toISOString() : local
}
