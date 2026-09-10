import { formatDistanceToNow } from "date-fns"
import { DateDisplay, type UserPreferenceValues } from "@/db/types"

/**
 * How one writer wants times written.
 *
 * The three Preferences that answer that question, and none of the five that do
 * not. Every caller happens to hold the whole row, so this narrows nothing at
 * the call site; it is here so a reader of these signatures can see what a date
 * is allowed to depend on without reading the bodies.
 */
export type DatePreferences = Pick<
	UserPreferenceValues,
	"dateDisplay" | "locale" | "timezone"
>

/**
 * `undefined` is how `Intl` spells "whatever the host says", which is what a
 * null column means. Passing null instead throws.
 */
function stated(value: string | null) {
	return value ?? undefined
}

/**
 * A moment in time: when a Draft was edited, when a session began, when the
 * Config was last read.
 *
 * The one formatter the `dateDisplay` Preference actually decides. Relative is
 * what every one of these surfaces did before there was a Preference, so a
 * writer who changes nothing sees no change.
 */
export function formatTimestamp(
	instant: Date,
	preferences: DatePreferences,
): string {
	if (preferences.dateDisplay === DateDisplay.RELATIVE) {
		return formatDistanceToNow(instant, { addSuffix: true })
	}
	// The absolute arm is `formatDatetime` rather than a second spelling of it:
	// the two are the same stamp, and a label that read differently under two
	// Preferences would be a bug. The tooltip hanging off it is allowed to
	// differ, and does — `formatDatetimeWithZone` says one thing more.
	return formatDatetime(instant, preferences)
}

/**
 * Whatever a value claims to be, as a Date — or null if it is not one.
 *
 * Every Field renderer starts here: a Source holds whatever a writer's file
 * held, so an unparseable stamp is an ordinary case to render rather than an
 * error to throw.
 */
export function toDate(value: unknown): Date | null {
	const parsed = new Date(value as string | number | Date)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * A calendar day, as a distance or as the day itself.
 *
 * The day-granularity twin of `formatTimestamp`, and it exists because that one
 * is wrong here: a `yyyy-MM-dd` value carries no time of day, so an absolute
 * reading through `formatDatetime` would print a midnight nobody wrote and, in
 * any zone behind UTC, print it against the previous day.
 */
export function formatDate(day: Date, preferences: DatePreferences): string {
	if (preferences.dateDisplay === DateDisplay.RELATIVE) {
		return formatDistanceToNow(day, { addSuffix: true })
	}
	return formatDay(day, preferences)
}

/**
 * A calendar day, spelt out.
 *
 * Never relative, whatever `dateDisplay` says: the one-line summary in a list
 * always reads this way, because a distance is not something to scan a list by.
 *
 * Read in UTC on purpose, and this is the whole reason the function exists.
 * `yyyy-MM-dd` parses to UTC midnight, so rendering it in a zone behind UTC
 * names the day before — the day nobody wrote down. A day is not an instant,
 * so the writer's zone has no say in which day it is.
 */
export function formatDay(day: Date, preferences: DatePreferences): string {
	return new Intl.DateTimeFormat(stated(preferences.locale), {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	}).format(day)
}

/**
 * A day and a time together.
 *
 * Also never relative — the time of day is the whole reason the datetime Field
 * Type exists, and "3 hours ago" hides it.
 */
export function formatDatetime(
	instant: Date,
	preferences: DatePreferences,
): string {
	return spellInstant(instant, preferences, "short")
}

/**
 * A day and a time, with the zone it is being read in named.
 *
 * The zone belongs here rather than on the label: every stamp on a page shares
 * one, so spelling it on each is noise, and a reader who wants to know which
 * clock they are looking at asks once. Without this there is nowhere to ask —
 * a writer who has stated no zone is being shown the machine's and is never
 * told which one that is.
 *
 * `timeStyle: "long"` is what names it. `Intl` refuses `timeZoneName` beside
 * `dateStyle`/`timeStyle`, and spelling every component out to avoid that buys
 * only the loss of the seconds `long` also brings — which a tooltip on a
 * stamped instant has room for.
 *
 * What it names is the offset in force at that instant (`GMT+9`, `BST`) rather
 * than the zone (`Asia/Tokyo`). That is the right answer for a stamp: the
 * question a reader has is which clock this one was read off, and a zone that
 * changes offset twice a year answers it less exactly than the offset does.
 * The zone itself is `resolvedTimezone`'s job, on the control where a writer
 * types an instant rather than reads one.
 */
export function formatDatetimeWithZone(
	instant: Date,
	preferences: DatePreferences,
): string {
	return spellInstant(instant, preferences, "long")
}

/**
 * The one instant format both public readings are, differing only in how much
 * of the time they spell. Two exports over it rather than one taking the flag,
 * because a caller is choosing between two questions — what time is this, and
 * on whose clock — not between two amounts of detail.
 */
function spellInstant(
	instant: Date,
	preferences: DatePreferences,
	timeStyle: "long" | "short",
): string {
	return new Intl.DateTimeFormat(stated(preferences.locale), {
		dateStyle: "medium",
		timeStyle,
		timeZone: stated(preferences.timezone),
	}).format(instant)
}

/**
 * The zone a null Preference resolves to — the machine's own, named.
 *
 * `stated` is enough everywhere a value is formatted, because `Intl` resolves
 * the null itself. It is not enough where the zone is the thing being said:
 * "Match my device" names no device.
 */
export function resolvedTimezone(timeZone: string | null): string {
	return new Intl.DateTimeFormat(undefined, {
		timeZone: stated(timeZone),
	}).resolvedOptions().timeZone
}

/**
 * What the clock in `timeZone` reads at `instant`, as `datetime-local` spells
 * it.
 *
 * `en-CA` for the parts rather than the writer's locale: this is a machine
 * format going into a form control, not something anyone reads.
 *
 * A null zone is the machine's own, the same way it is everywhere else here —
 * one rule for "the writer stated nothing", spelt in one place.
 */
export function toWallTime(instant: Date, timeZone: string | null): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone: stated(timeZone),
		year: "numeric",
	}).formatToParts(instant)

	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((candidate) => candidate.type === type)?.value ?? "00"
	// `hour12: false` spells midnight `24` in some implementations.
	const hour = part("hour") === "24" ? "00" : part("hour")

	return `${part("year")}-${part("month")}-${part("day")}T${hour}:${part("minute")}:${part("second")}`
}

/**
 * The instant at which the clock in `timeZone` reads `local`.
 *
 * Read the wall time as though it were UTC, then correct by the zone's offset.
 * Twice, because the offset used to find the instant is not always the offset
 * in force at it: an hour either side of a clock change, one pass lands in the
 * wrong one and the second pass walks back into the right one.
 *
 * An unparseable reading comes back as an invalid Date rather than a guess —
 * the same bargain `fromDatetimeLocal` already strikes, so the validator names
 * the problem instead of the field silently blanking.
 */
export function fromWallTime(local: string, timeZone: string | null): Date {
	const target = Date.parse(`${local}Z`)
	if (Number.isNaN(target)) return new Date(Number.NaN)

	let instant = target
	for (let pass = 0; pass < 2; pass++) {
		instant +=
			target - Date.parse(`${toWallTime(new Date(instant), timeZone)}Z`)
	}
	return new Date(instant)
}
