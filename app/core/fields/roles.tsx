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
 * today: the declarative `title: true` flag is a follow-up, and #73 stacks
 * `findTitleEntry` underneath this one as the fallback tier.
 */
export function resolveTitleKey(schema: Record<string, Field>): string | null {
	return findSlugField(schema)?.field.from ?? null
}

const TITLE_TARGETS = ["title", "name"] as const

/**
 * The Title Role's undeclared tier: the Field a reader would take for the
 * heading. A `title` beats a `name`, and a key beats a label — a key is what
 * the schema author wrote, a label is what they show.
 *
 * Both Containers ask it of their children, which is why it lives here rather
 * than in either of them. It is not yet folded into `resolveTitleKey`: the two
 * tiers have never consulted each other, and composing them would change what
 * both callers resolve today. #73 does that.
 */
export function findTitleEntry(
	entries: [string, Field][],
): { key: string; field: Field } | null {
	for (const target of TITLE_TARGETS) {
		const match = entries.find(([key]) => key.toLowerCase() === target)
		if (match) return { key: match[0], field: match[1] }
	}
	for (const target of TITLE_TARGETS) {
		const match = entries.find(
			([, field]) => field.label.toLowerCase() === target,
		)
		if (match) return { key: match[0], field: match[1] }
	}
	return null
}
