import invariant from "tiny-invariant"
import type { ArrayField, Field } from "@/config/types"
import { canonicalMetadata } from "@/core/content"
import type { OpenedContent } from "@/core/editor/collection-item-editor"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import { getCompositeValue, setCompositeValue } from "@/core/fields/composite"
import type { createSingletonDrafts } from "./create-drafts.server"
import type { CommitResult, DraftContent, SaveResult } from "./types"

/**
 * The row moved under the writer. Reported as the conflict it is, since another
 * session changed the Singleton this editor is a view onto.
 */
const REVISION_CONFLICT = { code: "revision-conflict", ok: false } as const

/**
 * One row of a Singleton's `array` Field as its own editor sees it: a record of
 * Fields and no Body. The row has no Source and no Draft of its own — every
 * transition reads the Singleton's Draft and writes the whole Singleton back,
 * so the Singleton stays the one thing that is saved and committed (#94).
 *
 * Null when the schema says no row can be at this address. Whether one is there
 * now is the Draft's answer, so `open` gives that one.
 */
export function createSingletonRowDrafts({
	drafts,
	fieldKey,
	itemIndex,
	schema,
}: {
	drafts: ReturnType<typeof createSingletonDrafts>
	fieldKey: string
	/** The URL's position, counted from one as the Singleton page counts rows. */
	itemIndex: string
	schema: Record<string, Field>
}) {
	const field = schema[fieldKey]
	if (field?.type !== "array" || field.items.length === 0) return null
	if (!/^[1-9]\d*$/.test(itemIndex)) return null
	const index = Number(itemIndex) - 1
	const arrayField = field

	/** The Singleton as it stands, and the row at this position when there is one. */
	async function locate() {
		const opened = await drafts.open()
		invariant(opened.ok, "A Singleton always opens")
		const rows = opened.fields[fieldKey]
		if (!Array.isArray(rows) || index >= rows.length) return null
		return { opened, row: rows[index] as unknown, rows }
	}

	async function open(): Promise<OpenedContent | null> {
		const located = await locate()
		if (!located) return null
		return {
			content: "",
			dirty: located.opened.dirty,
			draftId: located.opened.draftId,
			fields: rowFields(arrayField, located.row),
			revision: located.opened.revision,
		}
	}

	/**
	 * The whole Singleton with this row in place, or null when this position no
	 * longer holds the row the writer last saw. The Body is the Draft's own,
	 * never the caller's: a row has none, so a row edit cannot touch it.
	 */
	async function withRow(content: RowContent): Promise<DraftContent | null> {
		const located = await locate()
		if (
			!located ||
			content.baseFields === null ||
			canonicalMetadata(rowFields(arrayField, located.row)) !==
				canonicalMetadata(content.baseFields)
		)
			return null
		const { opened, row, rows } = located
		return {
			expectedRevision: content.expectedRevision,
			fields: {
				...opened.fields,
				[fieldKey]: rows.map((current, position) =>
					position === index
						? withRowFields(arrayField, row, content.fields)
						: current,
				),
			},
			markdown: opened.content,
		}
	}

	/** Persist the row as part of the Singleton's Draft. */
	async function save(content: RowContent): Promise<SaveResult> {
		const singleton = await withRow(content)
		if (!singleton) return REVISION_CONFLICT
		return drafts.save(singleton)
	}

	/**
	 * Save the whole Singleton to GitHub — the same commit its own editor makes.
	 * What the commit wrote comes back as this row, which is all the row editor
	 * holds.
	 */
	async function commit(content: RowContent): Promise<CommitResult<null>> {
		const singleton = await withRow(content)
		if (!singleton) return REVISION_CONFLICT
		const committed = await drafts.commit(singleton)
		if (!committed.ok || committed.outcome === "matches-source") {
			return committed
		}
		const rows = committed.fields[fieldKey] as unknown[]
		return { ...committed, fields: rowFields(arrayField, rows[index]) }
	}

	return { commit, open, save, schema: rowSchema(arrayField) }
}

/** What the row editor sends: its Fields, and what it last knew of them. */
export interface RowContent {
	/**
	 * The row as this editor last saw the server hold it. The Revision cannot
	 * tell a row that moved while no Draft existed — another session committed
	 * and its Draft is gone — so the row itself is the check that this position
	 * still holds the row the writer opened.
	 */
	baseFields: FieldRecord | null
	expectedRevision: number | null
	fields: FieldRecord
}

/**
 * Whether a row is a record of the one declared object's Fields. Otherwise it
 * is the one scalar item's value outright, or a composite of several items —
 * the three shapes `array` renders — and either is edited as one Field per
 * item, keyed by label as a composite row already is.
 */
function isObjectRow(field: ArrayField) {
	return field.items.length === 1 && field.items[0].type === "object"
}

/** The Fields one row is made of. */
function rowSchema(field: ArrayField): Record<string, Field> {
	const [sole] = field.items
	if (field.items.length === 1 && sole.type === "object") return sole.fields
	return Object.fromEntries(field.items.map((item) => [item.label, item]))
}

/**
 * One row's value as a record of those Fields. An item the row does not hold is
 * left out rather than set to `undefined`, so the record reads the same once it
 * has crossed the wire as JSON.
 */
function rowFields(field: ArrayField, row: unknown): FieldRecord {
	if (isObjectRow(field)) {
		return row && typeof row === "object" && !Array.isArray(row)
			? (row as FieldRecord)
			: {}
	}
	const values = field.items.map((item, itemIndex) => [
		item.label,
		field.items.length === 1 ? row : getCompositeValue(row, item, itemIndex),
	])
	return Object.fromEntries(values.filter(([, value]) => value !== undefined))
}

/** A row carrying these Fields, in the shape the row was written in. */
function withRowFields(
	field: ArrayField,
	row: unknown,
	fields: FieldRecord,
): unknown {
	if (isObjectRow(field)) return fields
	if (field.items.length === 1) return fields[field.items[0].label]
	return field.items.reduce(
		(next, item, itemIndex) =>
			setCompositeValue(next, item, itemIndex, fields[item.label]),
		row,
	)
}
