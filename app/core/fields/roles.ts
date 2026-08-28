import type { DocumentField, Field, SlugField } from "@/config/types"

/**
 * A Document Field reached the dispatcher.
 *
 * The Body is not a value: it has no default, nothing validates it as data, and
 * it is edited by the editor rather than a control. Every call site therefore
 * filters Document Fields out before dispatching, and one that forgot is a bug
 * in the caller. It throws rather than returning a message because there is no
 * value to complain about — the same reason `ContentParseError` throws.
 */
export class DocumentFieldError extends Error {
	constructor(field: DocumentField) {
		super(
			`Field "${field.label}" carries the Document Role: the Body is not a value, so it must be filtered out before dispatch`,
		)
		this.name = "DocumentFieldError"
	}
}

/**
 * The loud error, as an assertion so that what remains narrows: past this line
 * the only Role a Field can still carry is Slug, and the dispatcher can say so
 * with a plain discriminant test.
 */
export function refuseDocument(
	field: Field,
): asserts field is Exclude<Field, DocumentField> {
	if (field.type === "document") throw new DocumentFieldError(field)
}

/**
 * What the Slug Role fixes about the Field carrying it. Deriving the slug from
 * its source Field is not here: derivation writes one Field's value out of
 * another's, which makes it normalization of the Data rather than behavior of
 * the Role, and that stays in the metadata module.
 *
 * The behaviors take a context object for the same reason a registry entry's do
 * — rich render, inline render and the edit control join them in #71 and #72,
 * each with its own inputs.
 */
export const slugRole = {
	defaultValue: () => "",
	validate: ({ path, value }: { path: string; value: unknown }): string[] =>
		typeof value === "string" ? [] : [`${path} must be text`],
}

/**
 * The Field carrying the Slug Role, if the schema declares one. A Collection
 * must have exactly one and a Singleton may have none, both enforced in the
 * config layer, so the first match is the answer.
 */
export function findSlugField(
	schema: Record<string, Field>,
): { key: string; field: SlugField } | null {
	for (const [key, field] of Object.entries(schema)) {
		if (field.type === "slug") return { key, field }
	}
	return null
}

/**
 * Which Field heads this container — the Title Role.
 *
 * The documented resolution order is declared Title, else the Slug Role's
 * source Field, else the key/label heuristic. Only the middle tier exists
 * today: the declarative `title: true` flag is a follow-up, and the heuristic
 * still lives in the singleton route until #73 relocates it below this one.
 */
export function resolveTitleKey(schema: Record<string, Field>): string | null {
	return findSlugField(schema)?.field.from ?? null
}
