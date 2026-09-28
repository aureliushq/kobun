import type { ArrayField, Field } from "@/config/types"

/**
 * What one row of an `array` Field is, and how its item values are read and
 * written. The rich panel and the row editor both have to answer this, and the
 * row editor runs on the server — so it is answered here, once, in a module
 * whose every import is a type and which therefore pulls nothing along (#164).
 *
 * Deliberately its own module rather than part of `array`: `fields/index` says
 * why — it reaches every registry entry, and so reaches React, and this is the
 * one piece of the taxonomy a caller can want without wanting the rest.
 */

/**
 * Which item of a row a value belongs to: the key the row answers to, the
 * position the item was declared in, and the Field itself. The position travels
 * with the entry rather than being left implicit in the list, because a
 * composite row may be addressed by position as well as by label, and the rich
 * panel regroups entries into blocks — which detaches them from their place in
 * it.
 */
export type RowEntry = { field: Field; index: number; key: string }

/**
 * The three shapes a row comes in. Which one an array has follows from its
 * declared items alone, so it is decided once per array rather than once per
 * row, and there is always at least one entry:
 *
 * - `object` — one declared `object` item: the row is a record of that object's
 *   own Fields, keyed as the schema keys them.
 * - `scalar` — one declared item of any other Type: the row is that item's value
 *   outright, and the item's label is the only key there is. Named for the
 *   ordinary case rather than the rule — a sole `array` item is a Container, and
 *   its row is still its value outright.
 * - `composite` — several declared items: one value per item, keyed by item
 *   label or addressed by position, whichever the row was written in.
 */
export type ArrayRowShape = {
	entries: RowEntry[]
	kind: "composite" | "object" | "scalar"
}

/** Null when the schema declares no items: there is no row to describe. */
export function describeRow(field: ArrayField): ArrayRowShape | null {
	const items = field.items
	if (items.length === 0) return null
	const [sole] = items
	if (items.length === 1 && sole.type === "object") {
		return {
			entries: Object.entries(sole.fields).map(([key, item], index) => ({
				field: item,
				index,
				key,
			})),
			kind: "object",
		}
	}
	return {
		entries: items.map((item, index) => ({
			field: item,
			index,
			key: item.label,
		})),
		kind: items.length === 1 ? "scalar" : "composite",
	}
}

/**
 * One row's values, keyed the way its entries are. An item the row does not
 * hold is left out rather than set to `undefined`, so the record reads the same
 * once it has crossed the wire as JSON.
 *
 * An object row is handed back as it stands, including keys the schema never
 * declared: the editor writes that record straight back, so reading it one
 * declared entry at a time would quietly drop them from the content.
 */
export function rowValues(
	shape: ArrayRowShape,
	row: unknown,
): Record<string, unknown> {
	if (shape.kind === "object") {
		return row && typeof row === "object" && !Array.isArray(row)
			? (row as Record<string, unknown>)
			: {}
	}
	const values: [string, unknown][] = shape.entries.map((entry) => [
		entry.key,
		shape.kind === "scalar"
			? row
			: getCompositeValue(row, entry.field, entry.index),
	])
	return Object.fromEntries(values.filter(([, value]) => value !== undefined))
}

/** A row carrying these values, in the shape the row was written in. */
export function withRowValues(
	shape: ArrayRowShape,
	row: unknown,
	values: Record<string, unknown>,
): unknown {
	if (shape.kind === "object") return values
	if (shape.kind === "scalar") return values[shape.entries[0].key]
	return shape.entries.reduce(
		(next, entry) =>
			setCompositeValue(next, entry.field, entry.index, values[entry.key]),
		row,
	)
}

/**
 * How a composite row addresses one item's value. Such a row is either a tuple,
 * positionally indexed, or a record keyed by item label — content authored by
 * hand arrives as either, so both are read and the shape a row came in as is
 * the shape it goes back out as.
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
