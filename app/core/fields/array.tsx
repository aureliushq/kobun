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
import { getCompositeValue } from "./composite"
import { FieldRow, FieldsPanel, InlineText, JsonFallback } from "./presentation"
import { findTitleEntry } from "./roles"
import type {
	FieldTypeDefFor,
	RenderChild,
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

function capitalize(word: string): string {
	return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
}

type CompositeEntry = { key: string; index: number; field: Field }

/**
 * What one row of this array is, and how to read a value out of it. Three
 * shapes, decided once per array rather than once per row.
 */
type ArrayRowSchema =
	| {
			kind: "object"
			itemLabel: string
			entries: [string, Field][]
			titleField: { key: string; field: Field } | null
			getValue: (row: unknown, key: string) => unknown
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
			entries: CompositeEntry[]
			titleField: { key: string; field: Field } | null
			getValue: (row: unknown, key: string, index: number) => unknown
	  }

function describeArrayField(field: ArrayField): ArrayRowSchema | null {
	const items = field.items
	const itemLabel = itemLabelFor(field)
	if (items.length === 0) return null

	if (items.length === 1) {
		const sole = items[0]
		if (sole.type === "object") {
			const fields = sole.fields
			return {
				kind: "object",
				itemLabel,
				entries: Object.entries(fields),
				titleField: findTitleEntry(Object.entries(fields)),
				getValue: (row, key) =>
					row && typeof row === "object" && !Array.isArray(row)
						? (row as Record<string, unknown>)[key]
						: undefined,
			}
		}
		return {
			kind: "scalar",
			itemLabel,
			field: sole,
			getValue: (row) => row,
		}
	}

	// A composite row is keyed by item label, so the label doubles as the key —
	// which makes the title heuristic's two passes the same pass here.
	const compositeEntries: CompositeEntry[] = items.map((field, index) => ({
		key: field.label,
		index,
		field,
	}))
	return {
		kind: "composite",
		itemLabel,
		entries: compositeEntries,
		titleField: findTitleEntry(compositeEntries.map((e) => [e.key, e.field])),
		// Validation reads a row through `getCompositeValue`, which also accepts a
		// positional key on a record. The read path never has, and teaching it to
		// would put a value on the page where a dash is today — a visible change
		// this refactor is not for.
		getValue: (row, key, index) => {
			if (Array.isArray(row)) return row[index]
			if (row && typeof row === "object")
				return (row as Record<string, unknown>)[key]
			return undefined
		},
	}
}

/** What heads a row: its title-ish Field's value, or the row itself when it is a Scalar. */
function resolveRowTitle(
	rowSchema: ArrayRowSchema,
	row: unknown,
): { field: Field; value: unknown } | null {
	if (rowSchema.kind === "scalar") {
		return { field: rowSchema.field, value: row }
	}
	if (rowSchema.kind === "object") {
		if (!rowSchema.titleField) return null
		return {
			field: rowSchema.titleField.field,
			value: rowSchema.getValue(row, rowSchema.titleField.key),
		}
	}
	if (!rowSchema.titleField) return null
	const index = rowSchema.entries.findIndex(
		(entry) => entry.key === rowSchema.titleField?.key,
	)
	return {
		field: rowSchema.titleField.field,
		value: rowSchema.getValue(row, rowSchema.titleField.key, index),
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
	const rowSchema = describeArrayField(field)
	if (rowSchema == null) {
		return <JsonFallback value={value} />
	}

	const { editorPath, fieldKey } = ctx
	const isLevel1 = ctx.accordionDepth === 1
	const rows = items.map((item, index) => (
		<ArrayItemAccordion
			key={`${index}-${stableKey(item)}`}
			ctx={ctx}
			index={index}
			item={item}
			renderChild={renderChild}
			renderChildInline={renderChildInline}
			rowSchema={rowSchema}
		/>
	))

	if (isLevel1) {
		const addLink =
			editorPath && fieldKey ? `${editorPath}/${fieldKey}/new` : null
		return (
			<Card className="gap-0 overflow-hidden py-0">
				<CardHeader className="border-b py-3">
					<CardTitle>{field.label}</CardTitle>
					{addLink ? (
						<CardAction>
							<Button size="sm" render={<Link to={addLink} />}>
								Add {capitalize(rowSchema.itemLabel)}
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
	rowSchema,
}: {
	ctx: RenderContext
	index: number
	item: unknown
	rowSchema: ArrayRowSchema
} & RowRenderers) {
	const title = resolveRowTitle(rowSchema, item)
	const isLevel1 = ctx.accordionDepth === 1
	// Only the outermost array's rows have an editor of their own to link to,
	// and the editor addresses them from one, not zero.
	const itemEditorPath =
		isLevel1 && ctx.editorPath && ctx.fieldKey
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
							<span>{`${rowSchema.itemLabel} ${index + 1}`}</span>
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
					rowSchema={rowSchema}
				/>
			</AccordionContent>
		</AccordionItem>
	)
}

function ArrayItemPanel({
	item,
	renderChild,
	rowSchema,
}: {
	item: unknown
	renderChild: RenderChild
	rowSchema: ArrayRowSchema
}) {
	if (rowSchema.kind === "scalar") {
		return (
			<div className="pt-2">
				<dl className="flex flex-col divide-y rounded-lg border">
					<FieldRow field={rowSchema.field}>
						{renderChild(rowSchema.field, item)}
					</FieldRow>
				</dl>
			</div>
		)
	}

	if (rowSchema.kind === "object") {
		return (
			<div className="pt-2">
				<FieldsPanel
					entries={rowSchema.entries}
					renderChild={renderChild}
					value={item}
				/>
			</div>
		)
	}

	// A composite row is laid out like an object's fields, but its values are
	// addressed by position as well as by label, so it cannot borrow the panel.
	type CompositeBlock =
		| { kind: "fields"; entries: CompositeEntry[] }
		| { kind: "array"; entry: CompositeEntry }
	const blocks: CompositeBlock[] = []
	for (const entry of rowSchema.entries) {
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
								rowSchema.getValue(item, block.entry.key, block.entry.index),
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
								{renderChild(
									entry.field,
									rowSchema.getValue(item, entry.key, entry.index),
								)}
							</FieldRow>
						))}
					</dl>
				)
			})}
		</div>
	)
}
