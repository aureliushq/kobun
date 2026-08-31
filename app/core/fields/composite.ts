import type { Field } from "@/config/types"

/**
 * How one row of an `array` Field addresses its item values. A row is either a
 * tuple, positionally indexed, or a record keyed by item label — content
 * authored by hand arrives as either, so both are read and the shape a row came
 * in as is the shape it goes back out as.
 *
 * Deliberately its own module rather than part of `array`: the metadata module
 * re-exports these for the editor, and reaches this graph from server code that
 * must not pull React along when the entries gain rendering.
 */
export function getCompositeValue(row: unknown, field: Field, index: number) {
	if (Array.isArray(row)) return row[index]
	if (row && typeof row === "object") {
		const record = row as Record<string, unknown>
		return record[field.label] ?? record[String(index)]
	}
	return undefined
}

export function setCompositeValue(
	row: unknown,
	field: Field,
	index: number,
	value: unknown,
) {
	if (Array.isArray(row)) {
		const next = [...row]
		next[index] = value
		return next
	}
	return {
		...((row as Record<string, unknown> | null) ?? {}),
		[field.label]: value,
	}
}
