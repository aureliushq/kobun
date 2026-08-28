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
 * followed the Roles into `roles.ts`, because neither is behavior of a Role.
 * They are rules about what a filled-in schema looks like, which makes them
 * normalization of the Data, and that is the metadata module's job.
 */
export type DefaultForSchema = (
	schema: Record<string, Field>,
) => Record<string, unknown>

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

/**
 * What one Field Type owes. Every member is required and none may be optional:
 * a silently missing behavior is the bug class this registry exists to kill.
 * Read and edit rendering join this contract in #71 and #72, each as its own
 * context type — which is why every behavior takes a context object rather than
 * positional arguments. A new input then becomes one property, not a signature
 * change rippling through every entry.
 */
export type FieldTypeDef<F extends ValueField> = {
	defaultValue(context: DefaultContext<F>): unknown
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
