import type { FieldTypeDefFor } from "./types"

/**
 * A calendar day, written `YYYY-MM-DD`. The shape check is not enough on its
 * own — `2026-13-99` has the shape and is not a day — so the parse has to agree.
 */
export const dateField: FieldTypeDefFor<"date"> = {
	defaultValue: () => "",
	validate: ({ path, value }) =>
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(Date.parse(value))
			? []
			: [`${path} must be a valid date`],
}
