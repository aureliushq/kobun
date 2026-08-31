import type { ReactNode } from "react"
import type { Field } from "@/config/types"
import { ControlRow, EmptyValue, JsonFallback } from "./presentation"
import { fieldTypeRegistry } from "./registry"
import { refuseDocument, slugRole } from "./roles"
import type {
	ControlContext,
	DefaultForSchema,
	FieldTypeDef,
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
 * The same rule as the renders — Roles first, then the Field Type — and the
 * same division of labour. The dispatcher refuses a Document, hands the Slug
 * its fixed control, and builds the callback a Container's children arrive
 * through, chrome and all, so no entry can render a child without saying which
 * child it is. Everything else is the Field Type's own answer.
 */
export function renderFieldControl(
	field: Field,
	value: unknown,
	ctx: ControlContext,
): ReactNode {
	refuseDocument(field)
	if (field.type === "slug")
		return slugRole.renderControl({
			disabled: ctx.disabled,
			onChange: ctx.onChange,
			value,
		})

	return entryFor(field).renderControl({
		...ctx,
		field,
		// Only where the next value goes changes on the way down; everything else
		// a control needs is the same at every depth.
		renderChild: (child, childValue, childOnChange) => (
			<ControlRow field={child}>
				{renderFieldControl(child, childValue, {
					...ctx,
					onChange: childOnChange,
				})}
			</ControlRow>
		),
		value,
	})
}
