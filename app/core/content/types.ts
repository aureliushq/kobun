import type { Format } from "@/config/types"

/**
 * The parsed form of a Source: its Data, plus a Body for document Formats.
 *
 * `data` is always an object, possibly empty. `body` is a string for the
 * document Formats (`md`/`mdx`) and null for the data-only ones (`json`/`yaml`)
 * — giving a data-only document a Body is invalid, not ignorable.
 *
 * Note what is absent: nothing here describes *how* an unchanged document is
 * re-emitted byte-for-byte. The fidelity mechanism is the module's business;
 * a caller holds only the document.
 */
export type ContentDocument = {
	data: Record<string, unknown>
	body: string | null
}

/**
 * A Source's bytes do not decode into a Content Document.
 *
 * This throws rather than returning a result union — unlike the drafts module,
 * whose refusals model normal concurrent editing (ADR 0001), a corrupt Source
 * is exceptional. Parsing leniently into `{ data: {}, body: raw }` was rejected
 * in ADR 0002: a writer who edits a misparsed file and publishes would silently
 * destroy the original.
 */
export class ContentParseError extends Error {
	readonly format: Format

	constructor(format: Format, cause: unknown) {
		super(`Could not parse ${format} content`, { cause })
		this.name = "ContentParseError"
		this.format = format
	}
}
