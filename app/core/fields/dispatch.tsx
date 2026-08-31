import { format, isValid } from "date-fns"
import type { ReactNode } from "react"
import { Fragment } from "react"
import type { ArrayField, Field } from "@/config/types"
import { Button } from "@/ui/components/base/button"
import { Checkbox } from "@/ui/components/base/checkbox"
import { Input } from "@/ui/components/base/input"
import { Switch } from "@/ui/components/base/switch"
import { Textarea } from "@/ui/components/base/textarea"
import { getCompositeValue, setCompositeValue } from "./composite"
import { ControlRow, EmptyValue, JsonFallback } from "./presentation"
import { fieldTypeRegistry } from "./registry"
import { refuseDocument, slugRole } from "./roles"
import type {
	ControlContext,
	DefaultForField,
	DefaultForSchema,
	FieldTypeDef,
	RenderChildControl,
	RenderContext,
	ValueField,
} from "./types"

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
 * What counts as nothing to show — a narrower question than `isEmpty`. An empty
 * list has nothing to validate, but it has something to render: an array says
 * "No items." and offers the link that fixes that, which a dash cannot do.
 */
function isBlank(value: unknown) {
	return value == null || value === ""
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

////////////////////// RENDER //////////////////////

/** How deep a Field may nest before its value is dumped rather than rendered. */
const MAX_RENDER_DEPTH = 5

/** How many accordions may sit inside one another before the same applies. */
const MAX_ACCORDION_DEPTH = 2

/**
 * The rich panel: a Field as its own block of the page.
 *
 * Every cross-cutting decision is made here, in this order — the Roles, the two
 * nesting limits and the dump they fall back on, and the dash that stands for
 * nothing filled in. An entry is handed a value worth rendering and a context
 * to pass on, and is trusted with nothing else; the callbacks it recurses
 * through are built here too, so no entry can get a child's depth wrong.
 */
export function renderFieldValue(
	field: Field,
	value: unknown,
	ctx: RenderContext,
): ReactNode {
	refuseDocument(field)
	if (ctx.depth >= MAX_RENDER_DEPTH) return <JsonFallback value={value} />
	if (isBlank(value)) return <EmptyValue />
	if (field.type === "slug") return slugRole.renderValue({ value })
	if (field.type === "array" && ctx.accordionDepth >= MAX_ACCORDION_DEPTH)
		return <JsonFallback value={value} />

	// An array opens an accordion, so its children are one level deeper into
	// them than it is; nothing else moves.
	const scoped: RenderContext =
		field.type === "array"
			? { ...ctx, accordionDepth: ctx.accordionDepth + 1 }
			: ctx

	return entryFor(field).renderValue({
		ctx: scoped,
		field,
		// The editor links belong to the Field the page named, not to anything
		// nested inside it, so descending drops them.
		renderChild: (child, childValue) =>
			renderFieldValue(child, childValue, {
				...scoped,
				depth: scoped.depth + 1,
				editorPath: undefined,
				fieldKey: undefined,
			}),
		renderChildInline: renderFieldInline,
		value,
	})
}

/**
 * The one-line summary a Field gets when it heads an accordion row. No depth to
 * track: a summary is one line whatever it is summarizing.
 */
export function renderFieldInline(field: Field, value: unknown): ReactNode {
	refuseDocument(field)
	if (isBlank(value)) return <EmptyValue />
	if (field.type === "slug") return slugRole.renderInline({ value })
	return entryFor(field).renderInline({
		field,
		renderChildInline: renderFieldInline,
		value,
	})
}

////////////////////// CONTROL //////////////////////

/**
 * The editable control: a Field as an input the writer types into.
 *
 * The chain below arrived here verbatim from the metadata component, still
 * deciding every type in one place. The move is what gives it a seam a test can
 * hold — `control.test.tsx` is written against this function, and #72 dissolves
 * the chain into registry entries next.
 *
 * The one thing the move changes: a Document reaching here is refused, as it
 * already is on every other path. It used to render a text input.
 */
export function renderFieldControl(
	field: Field,
	value: unknown,
	ctx: ControlContext,
): ReactNode {
	refuseDocument(field)
	const { assetBaseUrl, defaultForField, disabled, onChange } = ctx

	// Chrome and input together, exactly what a top-level Field gets, so no
	// Container has to remember to say which child it is rendering. Only where
	// the next value goes changes on the way down.
	const renderChild: RenderChildControl = (
		child,
		childValue,
		childOnChange,
	) => (
		<ControlRow field={child}>
			{renderFieldControl(child, childValue, {
				...ctx,
				onChange: childOnChange,
			})}
		</ControlRow>
	)

	if (field.type === "object") {
		const record =
			value && typeof value === "object" && !Array.isArray(value)
				? (value as Record<string, unknown>)
				: {}
		return (
			<div className="space-y-3 rounded-md border p-3">
				{Object.entries(field.fields).map(([key, child]) => (
					<Fragment key={key}>
						{renderChild(child, record[key], (next) =>
							onChange({ ...record, [key]: next }),
						)}
					</Fragment>
				))}
			</div>
		)
	}
	if (field.type === "array") {
		const rows = Array.isArray(value) ? value : []
		return (
			<div className="space-y-2">
				{rows.map((row, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: array values have no stable identity in frontmatter
					<div className="space-y-2 rounded-md border p-3" key={index}>
						{field.items.length === 1
							? renderChild(field.items[0], row, (next) =>
									onChange(rows.map((item, i) => (i === index ? next : item))),
								)
							: field.items.map((item, itemIndex) => (
									<Fragment key={`${item.type}:${item.label}`}>
										{renderChild(
											item,
											getCompositeValue(row, item, itemIndex),
											(next) =>
												onChange(
													rows.map((current, i) =>
														i === index
															? setCompositeValue(
																	current,
																	item,
																	itemIndex,
																	next,
																)
															: current,
													),
												),
										)}
									</Fragment>
								))}
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={disabled || index === 0}
								onClick={() => {
									const next = [...rows]
									;[next[index - 1], next[index]] = [
										next[index],
										next[index - 1],
									]
									onChange(next)
								}}
							>
								Up
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={disabled || index === rows.length - 1}
								onClick={() => {
									const next = [...rows]
									;[next[index + 1], next[index]] = [
										next[index],
										next[index + 1],
									]
									onChange(next)
								}}
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
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					onClick={() =>
						onChange([...rows, emptyArrayItem(field, defaultForField)])
					}
				>
					Add {field.itemLabel ?? "item"}
				</Button>
			</div>
		)
	}
	if (field.type === "boolean")
		return field.componentType === "switch" ? (
			<Switch
				checked={value === true}
				disabled={disabled}
				onCheckedChange={onChange}
			/>
		) : (
			<Checkbox
				checked={value === true}
				disabled={disabled}
				onCheckedChange={(checked) => onChange(checked === true)}
			/>
		)
	if (field.type === "select" || field.type === "multi_select") {
		return (
			<select
				className="min-h-7 w-full rounded-md border bg-background px-2 text-sm"
				multiple={field.type === "multi_select"}
				disabled={disabled}
				value={
					field.type === "multi_select"
						? Array.isArray(value)
							? value.map(String)
							: []
						: String(value ?? "")
				}
				onChange={(event) =>
					onChange(
						field.type === "multi_select"
							? Array.from(
									event.currentTarget.selectedOptions,
									({ value }) => value,
								)
							: event.currentTarget.value,
					)
				}
			>
				<option value="">{field.placeholder ?? "Select…"}</option>
				{field.options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		)
	}
	if (field.type === "datetime") {
		return (
			<Input
				type="datetime-local"
				step="1"
				value={toDatetimeLocal(value)}
				disabled={disabled}
				onChange={(event) => onChange(fromDatetimeLocal(event.target.value))}
			/>
		)
	}
	const input =
		field.type === "text" && field.multiline ? (
			<Textarea
				value={String(value ?? "")}
				placeholder={field.placeholder}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
			/>
		) : (
			<Input
				type={
					field.type === "date" ? "date" : field.type === "url" ? "url" : "text"
				}
				value={String(value ?? "")}
				disabled={disabled}
				placeholder={"placeholder" in field ? field.placeholder : undefined}
				onChange={(event) => onChange(event.target.value)}
			/>
		)
	return (
		<>
			{input}
			{field.type === "image" && value ? (
				<img
					className="mt-2 max-h-40 rounded-md border object-contain"
					src={resolveImageSource(String(value), assetBaseUrl)}
					alt="Preview"
				/>
			) : null}
		</>
	)
}

/**
 * A row the writer just added. One declared item makes the row that item's
 * value outright; several make it a tuple, positionally addressed.
 */
function emptyArrayItem(field: ArrayField, defaultForField: DefaultForField) {
	if (field.items.length === 1) {
		return defaultForField(field.items[0])
	}
	return field.items.map((item) => defaultForField(item))
}

/**
 * A datetime is stored as a UTC instant but edited in the writer's local wall
 * time, which is the only thing `datetime-local` can speak. An unparseable
 * value shows an empty picker rather than an invented one.
 *
 * Seconds are carried (with `step="1"` on the control) so that editing a
 * stamped value does not silently round it down to the minute.
 */
function toDatetimeLocal(value: unknown) {
	const date = new Date(String(value ?? ""))
	return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : ""
}

function fromDatetimeLocal(local: string) {
	if (!local) return ""
	const date = new Date(local)
	// A browser without `datetime-local` degrades the control to a text input,
	// so junk is reachable. Hand it back rather than blanking what was typed —
	// the validator names the problem, an empty field would hide it.
	return isValid(date) ? date.toISOString() : local
}

function resolveImageSource(value: string, assetBaseUrl?: string) {
	if (/^(https?:|data:|\/)/i.test(value) || !assetBaseUrl) return value
	return `${assetBaseUrl}/${value
		.replace(/^\/+/, "")
		.split("/")
		.map(encodeURIComponent)
		.join("/")}`
}
