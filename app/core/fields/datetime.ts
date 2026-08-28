import { isValid, parseISO } from "date-fns"
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

/** An instant, as an ISO-8601 string carrying its zone. */
export const datetimeField: FieldTypeDefFor<"datetime"> = {
	defaultValue: () => "",
	validate: ({ path, value }) =>
		typeof value === "string" &&
		hasExplicitZone(value) &&
		isValid(parseISO(value))
			? []
			: [`${path} must be a valid date and time`],
}
