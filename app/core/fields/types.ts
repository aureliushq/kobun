import type { ReactNode } from "react"
import type { DocumentField, Field, SlugField } from "@/config/types"

/**
 * Every Field that carries a value: the Field union minus the two Role
 * variants. Slug and Document are structural assignments a schema makes, not
 * kinds of value, so they are not Field Types and get no registry entry
 * (ADR 0004).
 */
export type ValueField = Exclude<Field, DocumentField | SlugField>

/**
 * Every Field Type name — the registry's key set.
 *
 * Derived from the union so it can never drift, but widened through a template
 * literal: `FieldType` is private to the config package, so without the
 * widening nothing here could write `"text"`. Same reason `Format` is widened
 * in `@/config/types`.
 */
export type ValueFieldType = `${ValueField["type"]}`

/** The union variant a given Field Type name describes. */
export type FieldOfType<K extends ValueFieldType> = Extract<Field, { type: K }>

/**
 * Defaults for a nested schema.
 *
 * Injected rather than derived, and it stays that way: an object's default
 * carries two rules the registry must not learn — a nested Document key is
 * omitted entirely, and a nested Slug is derived from its source Field. Neither
 * followed the Roles into `roles.tsx`, because neither is behavior of a Role.
 * They are rules about what a filled-in schema looks like, which makes them
 * normalization of the Data, and that is the metadata module's job.
 */
export type DefaultForSchema = (
	schema: Record<string, Field>,
) => Record<string, unknown>

/**
 * Default one nested Field. An `array` Container asks for it when the writer
 * adds a row, and gets it injected for the same reason `DefaultForSchema` is:
 * what a Field defaults to is the dispatcher's answer, not a Container's.
 */
export type DefaultForField = (field: Field) => unknown

/**
 * Validate one nested Field at a path its container computed. The dispatcher
 * hands this to Container entries so they recurse without importing the
 * registry — no cycles, and no entry can get the bookkeeping wrong.
 */
export type ValidateChild = (
	field: Field,
	value: unknown,
	path: string,
) => string[]

/**
 * Where a render is happening: how deep the Field sits, whose repository its
 * assets belong to, and — only ever at the top level — the editor paths an
 * array Container hangs its "Add" and "Edit" links from.
 *
 * The depths are the dispatcher's to enforce — an entry never checks one
 * against a limit. `array` reads its own accordion depth for a different
 * question, and the only one an entry may ask of a depth: am I the outermost
 * one, or nested inside another?
 */
export type RenderContext = {
	accordionDepth: number
	depth: number
	editorPath?: string
	fieldKey?: string
	name: string
	owner: string
}

/**
 * Render one nested Field, one level down. The dispatcher binds the depth and
 * strips the editor paths before handing this to a Container, which is why no
 * entry computes a context of its own — same contract as `ValidateChild`.
 */
export type RenderChild = (field: Field, value: unknown) => ReactNode

/** Summarize one nested Field on a single line. */
export type RenderChildInline = (field: Field, value: unknown) => ReactNode

/**
 * Render one nested Field's control — its chrome and its input together, the
 * same pair a top-level Field gets. The dispatcher builds it so no Container
 * can render a child without the label that says which child it is.
 */
export type RenderChildControl = (
	field: Field,
	value: unknown,
	onChange: (value: unknown) => void,
) => ReactNode

export type DefaultContext<F extends ValueField> = {
	defaultForSchema: DefaultForSchema
	field: F
}

export type ValidateContext<F extends ValueField> = {
	field: F
	path: string
	validateChild: ValidateChild
	value: unknown
}

export type RenderValueContext<F extends ValueField> = {
	ctx: RenderContext
	field: F
	renderChild: RenderChild
	renderChildInline: RenderChildInline
	value: unknown
}

export type RenderInlineContext<F extends ValueField> = {
	field: F
	renderChildInline: RenderChildInline
	value: unknown
}

/**
 * Everything an editable Field needs that is neither the Field nor its value:
 * where its asset lives, how to default a new one, whether the form is locked,
 * and where its next value goes. Descending changes only the last of them.
 */
export type ControlContext = {
	assetBaseUrl?: string
	defaultForField: DefaultForField
	disabled?: boolean
	onChange(value: unknown): void
}

export type RenderControlContext<F extends ValueField> = ControlContext & {
	field: F
	renderChild: RenderChildControl
	value: unknown
}

/**
 * What one Field Type owes. Every member is required and none may be optional:
 * a silently missing behavior is the bug class this registry exists to kill.
 * Edit controls join this contract in #72, as their own context type — which is
 * why every behavior takes a context object rather than positional arguments. A
 * new input then becomes one property, not a signature change rippling through
 * every entry.
 */
export type FieldTypeDef<F extends ValueField> = {
	defaultValue(context: DefaultContext<F>): unknown
	renderInline(context: RenderInlineContext<F>): ReactNode
	renderValue(context: RenderValueContext<F>): ReactNode
	validate(context: ValidateContext<F>): string[]
}

/** The entry a given Field Type name owes, narrowed to that type's variant. */
export type FieldTypeDefFor<K extends ValueFieldType> = FieldTypeDef<
	FieldOfType<K>
>

type Assert<T extends true> = T

/**
 * If `Extract` ever stopped narrowing, every entry would collapse to
 * `FieldTypeDef<never>` — and still satisfy the registry, silently. This fails
 * the build instead.
 */
type _EntriesNarrow = Assert<
	[FieldOfType<"text">] extends [never] ? false : true
>
