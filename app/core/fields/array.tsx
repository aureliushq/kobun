import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDown } from "lucide-react"
import { Fragment } from "react"
import { Link } from "react-router"
import type { ArrayField, Field } from "@/config/types"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
} from "@/ui/components/base/accordion"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import {
	describeRow,
	getCompositeValue,
	type RowEntry,
	setCompositeValue,
} from "./composite"
import { FieldRow, FieldsPanel, InlineText, JsonFallback } from "./presentation"
import { resolveTitle } from "./roles"
import type {
	DefaultForField,
	FieldTypeDefFor,
	RenderChild,
	RenderChildControl,
	RenderChildInline,
	RenderContext,
} from "./types"

/**
 * Rows of items — a Container. One declared item makes each row that item's
 * value outright; several make each row a composite addressed by position or by
 * label. Children are validated and rendered through the injected callbacks,
 * never by reaching for the registry.
 */
export const arrayField: FieldTypeDefFor<"array"> = {
	defaultValue: () => [],
	renderControl: ({
		defaultForField,
		disabled,
		editorPath,
		field,
		fieldKey,
		onChange,
		renderChild,
		value,
	}) => (
		<ArrayControl
			defaultForField={defaultForField}
			disabled={disabled}
			field={field}
			rowEditorPath={
				editorPath && fieldKey ? `${editorPath}/${fieldKey}` : undefined
			}
			onChange={onChange}
			renderChild={renderChild}
			value={value}
		/>
	),
	// A summary line cannot show rows, so it says how many there are — the same
	// count a nested section puts in its badge.
	renderInline: ({ value }) => {
		const rows = Array.isArray(value) ? value : []
		return (
			<InlineText>
				{rows.length === 0
					? "No items"
					: `${rows.length} ${rows.length === 1 ? "item" : "items"}`}
			</InlineText>
		)
	},
	renderValue: ({ ctx, field, renderChild, renderChildInline, value }) => (
		<ArraySection
			ctx={ctx}
			field={field}
			renderChild={renderChild}
			renderChildInline={renderChildInline}
			value={value}
		/>
	),
	validate: ({ field, path, validateChild, value }) => {
		if (!Array.isArray(value)) return [`${path} must be an array`]
		return value.flatMap((row, index) => {
			if (field.items.length === 1)
				return validateChild(field.items[0], row, `${path}[${index}]`)
			if (!row || typeof row !== "object")
				return [`${path}[${index}] must be a row`]
			return field.items.flatMap((item, itemIndex) =>
				validateChild(
					item,
					getCompositeValue(row, item, itemIndex),
					`${path}[${index}].${item.label}`,
				),
			)
		})
	},
}

////////////////////// ROW SHAPE //////////////////////

/**
 * A React key for a row. Rows carry no identity of their own, so this pairs
 * with the index rather than replacing it: it keeps a row's element from being
 * reused for a different row's content when rows are reordered.
 */
function stableKey(value: unknown): string {
	if (value == null) return "null"
	if (typeof value === "string" || typeof value === "number")
		return String(value).slice(0, 32)
	try {
		return JSON.stringify(value).slice(0, 32)
	} catch {
		return "obj"
	}
}

/** What one row is called: the declared item label, else the array's own, singular. */
function itemLabelFor(field: ArrayField): string {
	if (field.itemLabel) return field.itemLabel
	return field.label.endsWith("s") ? field.label.slice(0, -1) : field.label
}

/**
 * What the panel needs of a row on top of its shape: what to call it, what
 * heads it, and how to read one of its values. The shape itself — which of the
 * three a row is, and what its entries are — is `describeRow`'s answer, so the
 * split is stated once and the row editor reads the same one (#164).
 */
type ArrayRowView =
	| {
			kind: "object"
			itemLabel: string
			entries: [string, Field][]
			titleField: RowEntry | null
			getValue: (row: unknown, entry: RowEntry) => unknown
	  }
	| {
			kind: "scalar"
			itemLabel: string
			field: Field
			getValue: (row: unknown) => unknown
	  }
	| {
			kind: "composite"
			itemLabel: string
			entries: RowEntry[]
			titleField: RowEntry | null
			getValue: (row: unknown, entry: RowEntry) => unknown
	  }

function describeArrayField(field: ArrayField): ArrayRowView | null {
	const shape = describeRow(field)
	if (!shape) return null
	const itemLabel = itemLabelFor(field)
	const { entries } = shape

	if (shape.kind === "scalar") {
		return {
			kind: "scalar",
			itemLabel,
			field: entries[0].field,
			getValue: (row) => row,
		}
	}

	// Both remaining shapes address a row by its entry's key — a composite row
	// is keyed by item label, so there the label doubles as the key — which
	// makes the title heuristic's two passes the same pass here. The entry it
	// names is kept whole, since reading the value wants its position too.
	const pairs = entries.map((entry): [string, Field] => [
		entry.key,
		entry.field,
	])
	const title = resolveTitle(pairs)
	const titleField = title
		? (entries.find((entry) => entry.key === title.key) ?? null)
		: null

	if (shape.kind === "object") {
		return {
			kind: "object",
			itemLabel,
			entries: pairs,
			titleField,
			getValue: (row, entry) =>
				row && typeof row === "object" && !Array.isArray(row)
					? (row as Record<string, unknown>)[entry.key]
					: undefined,
		}
	}

	return {
		kind: "composite",
		itemLabel,
		entries,
		titleField,
		// Validation reads a row through `getCompositeValue`, which also accepts a
		// positional key on a record. The read path never has, and teaching it to
		// would put a value on the page where a dash is today — a visible change
		// this refactor is not for.
		getValue: (row, entry) => {
			if (Array.isArray(row)) return row[entry.index]
			if (row && typeof row === "object")
				return (row as Record<string, unknown>)[entry.key]
			return undefined
		},
	}
}

/** What heads a row: its title-ish Field's value, or the row itself when it is a Scalar. */
function resolveRowTitle(
	rowView: ArrayRowView,
	row: unknown,
): { field: Field; value: unknown } | null {
	if (rowView.kind === "scalar") {
		return { field: rowView.field, value: row }
	}
	if (!rowView.titleField) return null
	return {
		field: rowView.titleField.field,
		value: rowView.getValue(row, rowView.titleField),
	}
}

////////////////////// SECTION //////////////////////

type RowRenderers = {
	renderChild: RenderChild
	renderChildInline: RenderChildInline
}

/**
 * The outermost array gets a card and the links to edit it; a nested one gets a
 * plain section with a count, because a card inside a card reads as a mistake.
 * Which it is follows from the accordion depth the dispatcher hands down.
 */
function ArraySection({
	ctx,
	field,
	renderChild,
	renderChildInline,
	value,
}: {
	ctx: RenderContext
	field: ArrayField
	value: unknown
} & RowRenderers) {
	const items = Array.isArray(value) ? value : []
	const rowView = describeArrayField(field)
	if (rowView == null) {
		return <JsonFallback value={value} />
	}

	const { editorPath } = ctx
	const isLevel1 = ctx.accordionDepth === 1
	const rows = items.map((item, index) => (
		<ArrayItemAccordion
			key={`${index}-${stableKey(item)}`}
			ctx={ctx}
			index={index}
			item={item}
			renderChild={renderChild}
			renderChildInline={renderChildInline}
			rowView={rowView}
		/>
	))

	if (isLevel1) {
		// Rows are added in the editor's own array control, which saves them into
		// the Draft; there is no page of its own for a new row (#162).
		const addLink = editorPath ?? null
		return (
			<Card className="gap-0 overflow-hidden py-0">
				<CardHeader className="border-b py-3">
					<CardTitle>{field.label}</CardTitle>
					{addLink ? (
						<CardAction>
							<Button size="sm" render={<Link to={addLink} />}>
								Add in editor
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent className="p-0">
					{items.length === 0 ? (
						<div className="m-4 rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
							No items.
						</div>
					) : (
						<Accordion
							defaultValue={[]}
							className="w-full rounded-none border-0"
						>
							{rows}
						</Accordion>
					)}
				</CardContent>
			</Card>
		)
	}

	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<h5 className="font-medium text-sm">{field.label}</h5>
				<Badge variant="outline" className="text-xs">
					{items.length} {items.length === 1 ? "item" : "items"}
				</Badge>
			</div>
			{items.length === 0 ? (
				<div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-xs">
					No items.
				</div>
			) : (
				<Accordion
					defaultValue={[]}
					className="w-full rounded-md border bg-background"
				>
					{rows}
				</Accordion>
			)}
		</section>
	)
}

function ArrayItemAccordion({
	ctx,
	index,
	item,
	renderChild,
	renderChildInline,
	rowView,
}: {
	ctx: RenderContext
	index: number
	item: unknown
	rowView: ArrayRowView
} & RowRenderers) {
	const title = resolveRowTitle(rowView, item)
	const isLevel1 = ctx.accordionDepth === 1
	// Only the outermost array's rows have an editor of their own to link to,
	// and the editor addresses them from one, not zero.
	const itemEditorPath =
		isLevel1 && ctx.editorPath && ctx.fieldKey && !ctx.hideRowEditLinks
			? `${ctx.editorPath}/${ctx.fieldKey}/${index + 1}`
			: null
	const triggerClass = isLevel1
		? "group/trigger flex flex-1 items-center gap-3 border border-transparent p-3 text-left text-sm outline-none transition-all hover:underline"
		: "group/trigger flex flex-1 items-center gap-3 border border-transparent p-2 text-left text-xs outline-none transition-all hover:underline"

	return (
		<AccordionItem value={`item-${index}`}>
			<AccordionPrimitive.Header className="flex items-center gap-1 pr-2">
				<AccordionPrimitive.Trigger
					data-slot="accordion-trigger"
					className={triggerClass}
				>
					<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-180" />
					<div className="min-w-0 flex-1 truncate">
						{title == null || title.value == null || title.value === "" ? (
							<span>{`${rowView.itemLabel} ${index + 1}`}</span>
						) : (
							renderChildInline(title.field, title.value)
						)}
					</div>
					<span className="shrink-0 text-muted-foreground text-xs">
						#{index + 1}
					</span>
				</AccordionPrimitive.Trigger>
				{itemEditorPath ? (
					<Button
						variant="outline"
						size="sm"
						render={<Link to={itemEditorPath} />}
					>
						Edit
					</Button>
				) : null}
			</AccordionPrimitive.Header>
			<AccordionContent>
				<ArrayItemPanel
					item={item}
					renderChild={renderChild}
					rowView={rowView}
				/>
			</AccordionContent>
		</AccordionItem>
	)
}

function ArrayItemPanel({
	item,
	renderChild,
	rowView,
}: {
	item: unknown
	renderChild: RenderChild
	rowView: ArrayRowView
}) {
	if (rowView.kind === "scalar") {
		return (
			<div className="pt-2">
				<dl className="flex flex-col divide-y rounded-lg border">
					<FieldRow field={rowView.field}>
						{renderChild(rowView.field, item)}
					</FieldRow>
				</dl>
			</div>
		)
	}

	if (rowView.kind === "object") {
		return (
			<div className="pt-2">
				<FieldsPanel
					entries={rowView.entries}
					renderChild={renderChild}
					value={item}
				/>
			</div>
		)
	}

	// A composite row is laid out like an object's fields, but its values are
	// addressed by position as well as by label, so it cannot borrow the panel.
	type CompositeBlock =
		| { kind: "fields"; entries: RowEntry[] }
		| { kind: "array"; entry: RowEntry }
	const blocks: CompositeBlock[] = []
	for (const entry of rowView.entries) {
		if (entry.field.type === "array") {
			blocks.push({ kind: "array", entry })
		} else {
			const last = blocks[blocks.length - 1]
			if (last && last.kind === "fields") {
				last.entries.push(entry)
			} else {
				blocks.push({ kind: "fields", entries: [entry] })
			}
		}
	}

	return (
		<div className="flex flex-col gap-4 pt-2">
			{blocks.map((block) => {
				if (block.kind === "array") {
					return (
						<Fragment key={`array:${block.entry.key}-${block.entry.index}`}>
							{renderChild(
								block.entry.field,
								rowView.getValue(item, block.entry),
							)}
						</Fragment>
					)
				}
				return (
					<dl
						key={`fields:${block.entries.map((e) => `${e.key}-${e.index}`).join(",")}`}
						className="flex flex-col divide-y rounded-lg border"
					>
						{block.entries.map((entry) => (
							<FieldRow key={`${entry.key}-${entry.index}`} field={entry.field}>
								{renderChild(entry.field, rowView.getValue(item, entry))}
							</FieldRow>
						))}
					</dl>
				)
			})}
		</div>
	)
}

////////////////////// CONTROL //////////////////////

/**
 * Rows the writer edits, reorders and throws away. Every button hands back a
 * whole new list rather than a change to the old one, because the value the
 * editor holds is the list — there is nothing else to patch.
 *
 * A row is addressed the same way validation addresses it: one declared item
 * makes the row that item's value outright, several make it a composite read
 * and written through the shape it arrived in.
 */
function ArrayControl({
	defaultForField,
	disabled,
	field,
	onChange,
	renderChild,
	rowEditorPath,
	value,
}: {
	defaultForField: DefaultForField
	disabled?: boolean
	field: ArrayField
	onChange(value: unknown): void
	renderChild: RenderChildControl
	/** Where each row opens in its own editor, addressed from one; absent where none does. */
	rowEditorPath?: string
	value: unknown
}) {
	const rows = Array.isArray(value) ? value : []
	const replaceRow = (index: number, next: unknown) =>
		onChange(rows.map((row, i) => (i === index ? next : row)))
	const swapRows = (index: number, other: number) => {
		const next = [...rows]
		;[next[other], next[index]] = [next[index], next[other]]
		onChange(next)
	}

	return (
		<div className="space-y-2">
			{rows.map((row, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: array values have no stable identity in frontmatter
				<div className="space-y-2 rounded-md border p-3" key={index}>
					{field.items.length === 1
						? renderChild(field.items[0], row, (next) =>
								replaceRow(index, next),
							)
						: field.items.map((item, itemIndex) => (
								<Fragment key={`${item.type}:${item.label}`}>
									{renderChild(
										item,
										getCompositeValue(row, item, itemIndex),
										(next) =>
											replaceRow(
												index,
												setCompositeValue(row, item, itemIndex, next),
											),
									)}
								</Fragment>
							))}
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={disabled || index === 0}
							onClick={() => swapRows(index, index - 1)}
						>
							Up
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={disabled || index === rows.length - 1}
							onClick={() => swapRows(index, index + 1)}
						>
							Down
						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={disabled}
							onClick={() => onChange(rows.filter((_, i) => i !== index))}
						>
							Remove
						</Button>
						{rowEditorPath && !disabled ? (
							<Button
								variant="outline"
								render={<Link to={`${rowEditorPath}/${index + 1}`} />}
							>
								Edit
							</Button>
						) : null}
					</div>
				</div>
			))}
			<Button
				type="button"
				variant="outline"
				disabled={disabled}
				onClick={() => onChange([...rows, emptyRow(field, defaultForField)])}
			>
				Add {field.itemLabel ?? "item"}
			</Button>
		</div>
	)
}

/**
 * A row the writer just added. Defaulting arrives injected rather than
 * imported: what a Field defaults to is the dispatcher's answer, and this entry
 * only has to ask it once per declared item.
 */
function emptyRow(field: ArrayField, defaultForField: DefaultForField) {
	if (field.items.length === 1) return defaultForField(field.items[0])
	return field.items.map((item) => defaultForField(item))
}
