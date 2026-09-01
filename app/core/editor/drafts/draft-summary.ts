import type { Collection } from "@/config/types"
import { resolveTitleKey } from "@/core/fields"

/** The columns a Draft is headed by. Everything else on the row is somebody else's. */
interface DraftColumns {
	markdown: string
	metadata: string | null
}

/** How many words of the Body stand in for a Title the writer has not typed. */
const EXCERPT_WORDS = 10

/**
 * The Draft's Data, if the row actually holds any. `metadata` is written as
 * `JSON.stringify(fields)`, but a row can predate a writer or carry a value
 * from a session that never finished — and a heading is not worth throwing over.
 */
function draftData(metadata: string | null): Record<string, unknown> | null {
	if (!metadata) return null

	let parsed: unknown
	try {
		parsed = JSON.parse(metadata)
	} catch {
		return null
	}

	if (typeof parsed !== "object" || parsed === null) return null
	return parsed as Record<string, unknown>
}

/**
 * The Title Role's value, when the Collection declares one and the writer has
 * filled it in. A Collection always declares a Slug whose source Field the
 * config layer forces to exist, so the key is missing only when there is no
 * Collection to read — its Config no longer declares it, or has none at all.
 */
function titleValue(draft: DraftColumns, collection: Collection | null) {
	if (!collection) return null

	const key = resolveTitleKey(collection.schema)
	const value = key === null ? undefined : draftData(draft.metadata)?.[key]
	if (value === undefined || value === null) return null

	const title = String(value).trim()
	return title === "" ? null : title
}

/** Block markers that open a line but say nothing about what it says. */
const BLOCK_MARKER = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/
/** Inline emphasis, which the excerpt shows as the writer meant it to read. */
const EMPHASIS = /[*`~]/g
/**
 * The emphasis underscores: the ones no word runs through. `_soft_` loses both
 * of its, and `snake_case` keeps the one the writer meant as a character.
 */
const EMPHASIS_UNDERSCORE = /(^|[^\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu

/**
 * The first few words the writer typed, as a stand-in for the Title they have
 * not. A Draft only exists once somebody typed something (#98), so this names
 * one Draft rather than the row of identical placeholders it replaces.
 *
 * The ellipsis is unconditional: it says this is the start of a Body and not a
 * heading, which is true of a short first line as much as a long one.
 */
function bodyExcerpt(markdown: string) {
	const line = markdown
		.split("\n")
		.map((candidate) => candidate.replace(BLOCK_MARKER, "").trim())
		.find((candidate) => candidate !== "")
	if (!line) return null

	const words = line
		.replace(EMPHASIS, "")
		.replace(EMPHASIS_UNDERSCORE, "$1")
		.split(/\s+/)
		.filter(Boolean)
	if (words.length === 0) return null
	return `${words.slice(0, EXCERPT_WORDS).join(" ")}…`
}

/**
 * What a Draft card is headed by: the Draft's Title, the opening of its Body
 * when it has no Title yet, and only then a placeholder — which a Draft reaches
 * just by holding no text at all.
 *
 * Named for the heading rather than the Title because only the first tier is
 * one: a Body excerpt is what the writer typed, not the Title Role's value, and
 * saying so keeps the Role's name meaning the Role.
 *
 * The whole heading comes back however long it is. Where it ends on screen is
 * the card's business, and a caller that truncated here would have nothing left
 * to reveal on hover.
 */
export function draftHeading(
	draft: DraftColumns,
	collection: Collection | null,
): string {
	return (
		titleValue(draft, collection) ?? bodyExcerpt(draft.markdown) ?? "Untitled"
	)
}
