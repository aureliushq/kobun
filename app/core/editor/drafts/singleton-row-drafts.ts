import invariant from "tiny-invariant"
import type { Field } from "@/config/types"
import { canonicalMetadata } from "@/core/content"
import type { OpenedContent } from "@/core/editor/collection-item-editor"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import {
	type ArrayRowShape,
	describeRow,
	rowValues,
	withRowValues,
} from "@/core/fields/composite"
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
	if (field?.type !== "array") return null
	const described = describeRow(field)
	if (!described) return null
	/**
	 * What a row of this array is, described once for the rich panel and this
	 * editor alike (#164). Annotated rather than inferred: the transitions below
	 * are hoisted, so the null the guard just ruled out would follow them in.
	 */
	const shape: ArrayRowShape = described
	if (!/^[1-9]\d*$/.test(itemIndex)) return null
	const index = Number(itemIndex) - 1
	/** The Fields one row is made of. */
	const rowSchema: Record<string, Field> = Object.fromEntries(
		shape.entries.map((entry): [string, Field] => [entry.key, entry.field]),
	)

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
			fields: rowValues(shape, located.row),
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
			canonicalMetadata(rowValues(shape, located.row)) !==
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
						? withRowValues(shape, row, content.fields)
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
		return { ...committed, fields: rowValues(shape, rows[index]) }
	}

	return { commit, open, save, schema: rowSchema }
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
