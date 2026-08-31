import type { ReactNode } from "react"
import type { DocumentField, Field, SlugField } from "@/config/types"
import { InlineText, TextControl } from "./presentation"

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
 * The rich render is a code chip because a slug is an identifier the writer has
 * to copy exactly — it goes in a URL, and a proportional font hides the
 * difference between what it says and what it is. A summary line has no room
 * for the distinction, so there it is plain text.
 *
 * Edited as plain text, and editable at all on purpose: a writer who does not
 * want the derived slug has to be able to say so, and the metadata module then
 * stops deriving over what they typed.
 *
 * The behaviors take a context object for the same reason a registry entry's
 * do: an input can join one of them without disturbing the rest.
 */
export const slugRole = {
	defaultValue: () => "",
	renderControl: ({
		disabled,
		field,
		onChange,
		value,
	}: {
		disabled?: boolean
		// The Field union's slug variant, not `SlugField`: the parsed schema drops
		// the placeholder the authored one may declare, and the control has to
		// honour whichever it is handed.
		field: Extract<Field, { type: "slug" }>
		onChange(value: unknown): void
		value: unknown
	}): ReactNode => (
		<TextControl
			disabled={disabled}
			onChange={onChange}
			placeholder={field.placeholder}
			value={value}
		/>
	),
	renderInline: ({ value }: { value: unknown }): ReactNode => (
		<InlineText>{String(value)}</InlineText>
	),
	renderValue: ({ value }: { value: unknown }): ReactNode => (
		<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
			{String(value)}
		</code>
	),
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
	return findSlugFields(Object.entries(schema))[0] ?? null
}

/** Every Field carrying the Slug Role, in declared order. */
function findSlugFields(entries: [string, Field][]) {
	const found: { key: string; field: SlugField }[] = []
	for (const [key, field] of entries) {
		if (field.type === "slug") found.push({ key, field })
	}
	return found
}

/** The Field a container is headed by, and the key it answers to. */
export type TitleEntry = { key: string; field: Field }

/**
 * Which Field heads this container — the Title Role.
 *
 * Declared Title first, then the Slug Role's source Field, then the key/label
 * heuristic. A tier that names a Field this container does not have hands over
 * to the next: a composite array row addresses its Fields by item label, so a
 * Slug's `from` — a key in the top-level schema — can point outside the entries
 * being resolved.
 *
 * The declared tier is absent because there is nothing to declare it with yet;
 * the `title: true` config flag is a follow-up.
 */
export function resolveTitle(entries: [string, Field][]): TitleEntry | null {
	return slugSource(entries) ?? findHeuristicTitles(entries)[0] ?? null
}

/** The Title Role over a schema, for the callers that only want the key. */
export function resolveTitleKey(schema: Record<string, Field>): string | null {
	return resolveTitle(Object.entries(schema))?.key ?? null
}

/** The Field the Slug Role derives from, when it is one of these Fields. */
function slugSource(entries: [string, Field][]): TitleEntry | null {
	for (const { field } of findSlugFields(entries)) {
		const source = entries.find(([key]) => key === field.from)
		if (source) return { key: source[0], field: source[1] }
	}
	return null
}

const TITLE_TARGETS = ["title", "name"] as const

/**
 * The Title Role's undeclared tier: the Fields a reader would take for the
 * heading, best first. A `title` beats a `name`, and a key beats a label — a
 * key is what the schema author wrote, a label is what they show, so the labels
 * are read only when no key is title-ish.
 *
 * Plural because the singleton page hoists every one of them to the top of the
 * page, while the Containers and `resolveTitle` take the first. Named after the
 * tier rather than the Role because it answers only for this one: a caller that
 * wants the Title Role's answer wants `resolveTitle`.
 */
export function findHeuristicTitles(entries: [string, Field][]): TitleEntry[] {
	const byKey = titlesBy(entries, ([key]) => key)
	return byKey.length > 0
		? byKey
		: titlesBy(entries, ([, field]) => field.label)
}

/** The Fields whose key, or whose label, is one of the targets — best first. */
function titlesBy(
	entries: [string, Field][],
	read: (entry: [string, Field]) => string,
): TitleEntry[] {
	const found: TitleEntry[] = []
	for (const target of TITLE_TARGETS) {
		const match = entries.find((entry) => read(entry).toLowerCase() === target)
		if (match) found.push({ key: match[0], field: match[1] })
	}
	return found
}
