import { isMatch } from "date-fns"
import type { FieldTypeDefFor } from "./types"

/**
 * A calendar day, written `yyyy-MM-dd`. The check is the parse: a shape test
 * alone would accept `2026-02-30`, which has the shape and is not a day.
 * Padding is where the parse is lenient — `2026-7-14` is accepted — and that
 * leniency is the contract, not an oversight.
 */
export const dateField: FieldTypeDefFor<"date"> = {
	defaultValue: () => "",
	validate: ({ path, value }) =>
		typeof value === "string" && isMatch(value, "yyyy-MM-dd")
			? []
			: [`${path} must be a valid date`],
}
