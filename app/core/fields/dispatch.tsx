import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { format, formatDistanceToNow } from "date-fns"
import { ChevronDown } from "lucide-react"
import { Fragment, type ReactNode } from "react"
import { Link } from "react-router"
import type {
	ArrayField,
	Field,
	ObjectField,
	SelectField,
} from "@/config/types"
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
	capitalize,
	EmptyValue,
	FieldRow,
	JsonFallback,
	singularize,
	stableKey,
} from "./presentation"
import { fieldTypeRegistry } from "./registry"
import { refuseDocument, slugRole } from "./roles"
import type {
	DefaultForSchema,
	FieldTypeDef,
	RenderContext,
	ValueField,
} from "./types"

/** The shape of one declared choice. `@/config/types` keeps it private. */
type SelectOption = SelectField["options"][number]

/**
 * What counts as nothing filled in. Note an empty object is not empty: a
 * present-but-blank object still owes its required children.
 */
function isEmpty(value: unknown) {
	return (
		value == null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	)
}

/**
 * A registry key and a Field's discriminant are the same string, but TypeScript
 * cannot correlate an indexed access with the union member that produced it.
 * The one cast in the module, and the reason it is worth having in only one
 * place.
 */
function entryFor<F extends ValueField>(field: F): FieldTypeDef<F> {
	return fieldTypeRegistry[field.type] as unknown as FieldTypeDef<F>
}

/**
 * Roles first, then the Field Type. Nothing below this line is a fallthrough:
 * past the Role check the lookup is total over every Field Type, and the
 * compiler says so.
 */
export function defaultForField(
	field: Field,
	defaultForSchema: DefaultForSchema,
): unknown {
	refuseDocument(field)
	if (field.type === "slug") return slugRole.defaultValue()
	return entryFor(field).defaultValue({ defaultForSchema, field })
}

/**
 * The required check and the empty short-circuit live here, not in entries:
 * `required` is declared on every Field regardless of type, and the ordering is
 * load-bearing — a required Field that is empty says so and never reaches its
 * type's rules, while an optional empty one is simply left alone.
 *
 * The Document refusal sits above both, because it is not a complaint about the
 * value: an empty Document must still be refused, or a call site that forgot to
 * filter one out would be told nothing at all.
 *
 * Container entries recurse by being handed this function, which is why no
 * entry ever imports the registry.
 */
export function validateField(
	field: Field,
	value: unknown,
	path: string,
): string[] {
	refuseDocument(field)
	if (field.required && isEmpty(value)) return [`${path} is required`]
	if (isEmpty(value)) return []
	if (field.type === "slug") return slugRole.validate({ path, value })
	return entryFor(field).validate({
		field,
		path,
		validateChild: validateField,
		value,
	})
}

////////////////////// RENDER BOOKKEEPING //////////////////////

/** How deep a Field may nest before its value is dumped rather than rendered. */
const MAX_RENDER_DEPTH = 5

/** How many accordions may sit inside one another before the same applies. */
const MAX_ACCORDION_DEPTH = 2

/**
 * The rich panel: a Field as its own block of the page.
 *
 * Everything cross-cutting is decided here — the nesting limits and their JSON
 * fallback, and the dash that stands for nothing filled in — so that no entry
 * can get the bookkeeping wrong.
 */
export function renderFieldValue(
	field: Field,
	value: unknown,
	ctx: RenderContext,
): ReactNode {
	if (ctx.depth >= MAX_RENDER_DEPTH) {
		return <JsonFallback value={value} />
	}

	if (value == null || value === "") {
		return <EmptyValue />
	}

	switch (field.type) {
		case "text":
			return <TextValue value={value} multiline={!!field.multiline} />
		case "slug":
			return (
				<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
					{String(value)}
				</code>
			)
		case "url":
			return <UrlValue value={value} />
		case "date":
			return <DateValue value={value} />
		case "datetime":
			return <DatetimeValue value={value} />
		case "boolean":
			return <BooleanValue value={value} />
		case "image":
			return <ImageValue value={value} ctx={ctx} />
		case "select":
			return <SelectValueView value={value} options={field.options} />
		case "multi_select":
			return <MultiSelectValue value={value} options={field.options} />
		case "array":
			if (ctx.accordionDepth >= MAX_ACCORDION_DEPTH) {
				return <JsonFallback value={value} />
			}
			return (
				<ArraySection
					field={field}
					value={value}
					ctx={{ ...ctx, accordionDepth: ctx.accordionDepth + 1 }}
				/>
			)
		case "object":
			return <ObjectValueBlock value={value} fields={field.fields} ctx={ctx} />
		default:
			return <JsonFallback value={value} />
	}
}

/** The one-line summary a Field gets when it heads an accordion row. */
export function renderFieldInline(field: Field, value: unknown): ReactNode {
	if (value == null || value === "") {
		return <EmptyValue />
	}

	switch (field.type) {
		case "text":
		case "slug":
		case "url":
			return <span className="truncate">{String(value)}</span>
		case "date": {
			const d = new Date(value as string | number | Date)
			if (Number.isNaN(d.getTime())) {
				return <span className="truncate">{String(value)}</span>
			}
			const formatted = d.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
			return <span className="truncate">{formatted}</span>
		}
		case "datetime": {
			const d = new Date(value as string | number | Date)
			if (Number.isNaN(d.getTime())) {
				return <span className="truncate">{String(value)}</span>
			}
			return <span className="truncate">{formatDatetime(d)}</span>
		}
		case "boolean": {
			const truthy = value === true || value === "true"
			return <span className="truncate">{truthy ? "True" : "False"}</span>
		}
		case "select": {
			const options = field.options
			const match = options.find((o) => o.value === String(value))
			return (
				<span className="truncate">{match ? match.label : String(value)}</span>
			)
		}
		case "multi_select": {
			const options = field.options
			const arr = Array.isArray(value) ? value : []
			const labels = arr.map((v) => {
				const m = options.find((o) => o.value === String(v))
				return m ? m.label : String(v)
			})
			return <span className="truncate">{labels.join(", ")}</span>
		}
		default:
			return <span className="truncate">{String(value)}</span>
	}
}

////////////////////// SCALAR RENDERS //////////////////////

function TextValue({
	value,
	multiline,
}: {
	value: unknown
	multiline: boolean
}) {
	const str = String(value)
	if (multiline) {
		return <p className="whitespace-pre-wrap">{str}</p>
	}
	return <span>{str}</span>
}

function UrlValue({ value }: { value: unknown }) {
	const href = String(value)
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="break-all text-primary underline-offset-4 hover:underline"
		>
			{href}
		</a>
	)
}

function DateValue({ value }: { value: unknown }) {
	const d = new Date(value as string | number | Date)
	if (Number.isNaN(d.getTime())) {
		return <span className="text-muted-foreground italic">invalid date</span>
	}
	return (
		<span title={String(value)}>
			{formatDistanceToNow(d, { addSuffix: true })}
		</span>
	)
}

/**
 * A date is shown as a distance from now; a datetime is not, because the time
 * of day is the whole reason the type exists and "3 hours ago" hides it.
 */
function formatDatetime(date: Date) {
	return format(date, "MMM d, yyyy, h:mm a")
}

function DatetimeValue({ value }: { value: unknown }) {
	const d = new Date(value as string | number | Date)
	if (Number.isNaN(d.getTime())) {
		return <span className="text-muted-foreground italic">invalid date</span>
	}
	return <span title={String(value)}>{formatDatetime(d)}</span>
}

function BooleanValue({ value }: { value: unknown }) {
	const truthy = value === true || value === "true"
	return (
		<Badge
			variant="outline"
			className={
				truthy
					? "border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400"
					: "border-muted-foreground/30 bg-muted text-muted-foreground"
			}
		>
			{truthy ? "true" : "false"}
		</Badge>
	)
}

function ImageValue({ value, ctx }: { value: unknown; ctx: RenderContext }) {
	const raw = String(value)
	const isAbsolute = /^(https?:|data:)/i.test(raw)
	const src = isAbsolute ? raw : repoAssetUrl(ctx.owner, ctx.name, raw)
	return (
		<div className="flex flex-col gap-2">
			<img
				src={src}
				alt=""
				className="max-h-64 max-w-md rounded border object-contain"
			/>
			<span className="break-all font-mono text-muted-foreground text-xs">
				{raw}
			</span>
		</div>
	)
}

function repoAssetUrl(owner: string, name: string, path: string): string {
	const trimmed = path.replace(/^\/+/, "")
	const segments = trimmed.split("/").map(encodeURIComponent).join("/")
	return `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${segments}`
}

function SelectValueView({
	value,
	options,
}: {
	value: unknown
	options: SelectOption[]
}) {
	const match = options.find((o) => o.value === String(value))
	return <Badge variant="outline">{match ? match.label : String(value)}</Badge>
}

function MultiSelectValue({
	value,
	options,
}: {
	value: unknown
	options: SelectOption[]
}) {
	const arr = Array.isArray(value) ? value : []
	if (arr.length === 0) {
		return <EmptyValue />
	}
	return (
		<div className="flex flex-wrap gap-1">
			{arr.map((v, i) => {
				const match = options.find((o) => o.value === String(v))
				return (
					<Badge key={`${String(v)}-${i}`} variant="outline">
						{match ? match.label : String(v)}
					</Badge>
				)
			})}
		</div>
	)
}

////////////////////// TITLE / ROW DESCRIPTORS //////////////////////

const TITLE_TARGETS = ["title", "name"] as const

function findObjectTitleField(
	fields: Record<string, Field>,
): { key: string; field: Field } | null {
	const entries = Object.entries(fields)
	// Prefer case-insensitive KEY match: title > name.
	for (const target of TITLE_TARGETS) {
		const match = entries.find(([k]) => k.toLowerCase() === target)
		if (match) return { key: match[0], field: match[1] }
	}
	// Fallback: case-insensitive LABEL match.
	for (const target of TITLE_TARGETS) {
		const match = entries.find(([, f]) => f.label.toLowerCase() === target)
		if (match) return { key: match[0], field: match[1] }
	}
	return null
}

type CompositeEntry = { key: string; index: number; field: Field }

function findCompositeTitleField(
	entries: CompositeEntry[],
): { key: string; field: Field } | null {
	for (const target of TITLE_TARGETS) {
		const m = entries.find((e) => e.key.toLowerCase() === target)
		if (m) return { key: m.key, field: m.field }
	}
	for (const target of TITLE_TARGETS) {
		const m = entries.find((e) => e.field.label.toLowerCase() === target)
		if (m) return { key: m.key, field: m.field }
	}
	return null
}

type ArrayRowSchema =
	| {
			kind: "object"
			itemLabel: string
			objectField: ObjectField
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
	const itemLabel = field.itemLabel ?? singularize(field.label)
	if (items.length === 0) return null

	if (items.length === 1) {
		const sole = items[0]
		if (sole.type === "object") {
			const fields = sole.fields
			return {
				kind: "object",
				itemLabel,
				objectField: sole,
				entries: Object.entries(fields),
				titleField: findObjectTitleField(fields),
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

	const compositeEntries: CompositeEntry[] = items.map((f, i) => ({
		key: f.label,
		index: i,
		field: f,
	}))
	return {
		kind: "composite",
		itemLabel,
		entries: compositeEntries,
		titleField: findCompositeTitleField(compositeEntries),
		getValue: (row, key, index) => {
			if (Array.isArray(row)) return row[index]
			if (row && typeof row === "object")
				return (row as Record<string, unknown>)[key]
			return undefined
		},
	}
}

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
	const idx = rowSchema.entries.findIndex(
		(e) => e.key === rowSchema.titleField?.key,
	)
	return {
		field: rowSchema.titleField.field,
		value: rowSchema.getValue(row, rowSchema.titleField.key, idx),
	}
}

////////////////////// OBJECT RENDERS //////////////////////

type FieldBlock =
	| { kind: "fields"; entries: [string, Field][] }
	| { kind: "array"; key: string; field: Field }

function buildObjectBlocks(entries: [string, Field][]): FieldBlock[] {
	const blocks: FieldBlock[] = []
	for (const entry of entries) {
		const [key, field] = entry
		if (field.type === "array") {
			blocks.push({ kind: "array", key, field })
		} else {
			const last = blocks[blocks.length - 1]
			if (last && last.kind === "fields") {
				last.entries.push(entry)
			} else {
				blocks.push({ kind: "fields", entries: [entry] })
			}
		}
	}
	return blocks
}

function ObjectFieldsList({
	entries,
	value,
	ctx,
}: {
	entries: [string, Field][]
	value: unknown
	ctx: RenderContext
}) {
	if (ctx.depth >= MAX_RENDER_DEPTH) {
		return <JsonFallback value={value} />
	}
	if (entries.length === 0) {
		return <JsonFallback value={value} />
	}
	const obj =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {}
	const childCtx: RenderContext = { ...ctx, depth: ctx.depth + 1 }
	const blocks = buildObjectBlocks(entries)

	return (
		<div className="flex flex-col gap-4">
			{blocks.map((block) => {
				if (block.kind === "array") {
					return (
						<Fragment key={`array:${block.key}`}>
							{renderFieldValue(block.field, obj[block.key], childCtx)}
						</Fragment>
					)
				}
				return (
					<dl
						key={`fields:${block.entries.map(([k]) => k).join(",")}`}
						className="flex flex-col divide-y rounded-lg border"
					>
						{block.entries.map(([key, field]) => (
							<FieldRow key={key} field={field}>
								{renderFieldValue(field, obj[key], childCtx)}
							</FieldRow>
						))}
					</dl>
				)
			})}
		</div>
	)
}

function ObjectValueBlock({
	value,
	fields,
	ctx,
}: {
	value: unknown
	fields: Record<string, Field>
	ctx: RenderContext
}) {
	const entries = Object.entries(fields)
	if (entries.length === 0) {
		return <JsonFallback value={value} />
	}
	return <ObjectFieldsList entries={entries} value={value} ctx={ctx} />
}

////////////////////// ARRAY RENDERS //////////////////////

function ArraySection({
	field,
	value,
	ctx,
}: {
	field: ArrayField
	value: unknown
	ctx: RenderContext
}) {
	const items = Array.isArray(value) ? value : []
	const rowSchema = describeArrayField(field)
	if (rowSchema == null) {
		return <JsonFallback value={value} />
	}

	const { editorPath, fieldKey } = ctx
	const isLevel1 = ctx.accordionDepth === 1

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
							{items.map((item, i) => (
								<ArrayItemAccordion
									key={`${i}-${stableKey(item)}`}
									rowSchema={rowSchema}
									item={item}
									index={i}
									ctx={ctx}
								/>
							))}
						</Accordion>
					)}
				</CardContent>
			</Card>
		)
	}

	// Level 2 — plain section.
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
					{items.map((item, i) => (
						<ArrayItemAccordion
							key={`${i}-${stableKey(item)}`}
							rowSchema={rowSchema}
							item={item}
							index={i}
							ctx={ctx}
						/>
					))}
				</Accordion>
			)}
		</section>
	)
}

function ArrayItemAccordion({
	rowSchema,
	item,
	index,
	ctx,
}: {
	rowSchema: ArrayRowSchema
	item: unknown
	index: number
	ctx: RenderContext
}) {
	const title = resolveRowTitle(rowSchema, item)
	const fallbackTitle = `${rowSchema.itemLabel} ${index + 1}`
	const isLevel1 = ctx.accordionDepth === 1
	const showEdit = !!ctx.editorPath && !!ctx.fieldKey && isLevel1
	const itemEditorPath = showEdit
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
						<ItemTitle title={title} fallback={fallbackTitle} />
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
				<ArrayItemPanel rowSchema={rowSchema} item={item} ctx={ctx} />
			</AccordionContent>
		</AccordionItem>
	)
}

function ItemTitle({
	title,
	fallback,
}: {
	title: { field: Field; value: unknown } | null
	fallback: string
}) {
	if (!title || title.value == null || title.value === "") {
		return <span>{fallback}</span>
	}
	return renderFieldInline(title.field, title.value)
}

function ArrayItemPanel({
	rowSchema,
	item,
	ctx,
}: {
	rowSchema: ArrayRowSchema
	item: unknown
	ctx: RenderContext
}) {
	// Children of the panel render at the same accordionDepth; depth bumps
	// when descending into object fields (handled by ObjectFieldsList).
	const childCtx: RenderContext = { ...ctx, depth: ctx.depth + 1 }

	if (rowSchema.kind === "scalar") {
		return (
			<div className="pt-2">
				<dl className="flex flex-col divide-y rounded-lg border">
					<FieldRow field={rowSchema.field}>
						{renderFieldValue(rowSchema.field, item, childCtx)}
					</FieldRow>
				</dl>
			</div>
		)
	}

	if (rowSchema.kind === "object") {
		return (
			<div className="pt-2">
				<ObjectFieldsList entries={rowSchema.entries} value={item} ctx={ctx} />
			</div>
		)
	}

	// Composite — group consecutive non-array entries into a bordered FieldRow
	// list; arrays render as separate sections (mirrors ObjectFieldsList).
	type CompositeBlock =
		| { kind: "fields"; entries: CompositeEntry[] }
		| { kind: "array"; entry: CompositeEntry }
	const blocks: CompositeBlock[] = []
	for (const e of rowSchema.entries) {
		if (e.field.type === "array") {
			blocks.push({ kind: "array", entry: e })
		} else {
			const last = blocks[blocks.length - 1]
			if (last && last.kind === "fields") {
				last.entries.push(e)
			} else {
				blocks.push({ kind: "fields", entries: [e] })
			}
		}
	}

	return (
		<div className="flex flex-col gap-4 pt-2">
			{blocks.map((block) => {
				if (block.kind === "array") {
					return (
						<Fragment key={`array:${block.entry.key}-${block.entry.index}`}>
							{renderFieldValue(
								block.entry.field,
								rowSchema.getValue(item, block.entry.key, block.entry.index),
								childCtx,
							)}
						</Fragment>
					)
				}
				return (
					<dl
						key={`fields:${block.entries.map((e) => `${e.key}-${e.index}`).join(",")}`}
						className="flex flex-col divide-y rounded-lg border"
					>
						{block.entries.map((e) => (
							<FieldRow key={`${e.key}-${e.index}`} field={e.field}>
								{renderFieldValue(
									e.field,
									rowSchema.getValue(item, e.key, e.index),
									childCtx,
								)}
							</FieldRow>
						))}
					</dl>
				)
			})}
		</div>
	)
}
