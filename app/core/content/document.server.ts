/**
 * The two directions of the Content Document, for every Format.
 *
 * The whole fidelity contract is one law:
 *
 *     serializeDocument(parseDocument(raw, f), f, { raw }) === raw
 *
 * `serializeDocument` takes the original bytes rather than an opaque prefix a
 * caller has to carry around (ADR 0002): it re-parses them, compares the Data
 * canonically, and either re-emits the writer's own bytes untouched or
 * re-stringifies the document. How that is achieved is nobody else's business.
 *
 * This module knows Formats, not schemas — no Field type, no defaults, no slug
 * derivation. That lives in `@/core/editor/collection-metadata`.
 */

import YAML from "yaml"
import type { Format } from "@/config/types"
import { parseFrontmatter, stringifyFrontmatter } from "@/lib/frontmatter"
import { canonicalMetadata, normalizeMetadata } from "./normalize"
import { type ContentDocument, ContentParseError } from "./types"

/**
 * The Source's bytes as they stand today. The serializer takes these rather
 * than a prefix the caller has held onto, so that the fidelity mechanism never
 * becomes part of anyone else's contract (ADR 0002).
 */
type OriginalSource = { raw: string }

/**
 * The data-only Formats: the ones whose whole file is Data, with no Body. Each
 * pairs the two directions of that encoding; every Format branch in this module
 * comes from this one table.
 */
const DATA_CODECS = {
	json: {
		parse: (raw: string) => JSON.parse(raw),
		stringify: (data: Record<string, unknown>) =>
			JSON.stringify(data, null, "\t"),
	},
	yaml: {
		parse: (raw: string) => YAML.parse(raw),
		stringify: (data: Record<string, unknown>) => YAML.stringify(data),
	},
}

type DataOnlyFormat = keyof typeof DATA_CODECS

function isDataOnly(format: Format): format is DataOnlyFormat {
	return format in DATA_CODECS
}

/**
 * Data is always an object. A root that parses to an array or a scalar is a
 * file kobun cannot edit, so it is malformed rather than silently empty — an
 * empty editor over real content is how a writer publishes their file away.
 *
 * An empty YAML document is the one exception: it parses to null and is
 * legitimately empty Data. JSON has no such empty form, so a `null` root there
 * is a scalar like any other.
 */
function asData(
	parsed: unknown,
	format: DataOnlyFormat,
): Record<string, unknown> {
	if (parsed == null && format === "yaml") return {}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new ContentParseError(
			format,
			new TypeError(`Expected an object at the root of a ${format} document`),
		)
	}
	return normalizeMetadata(parsed) as Record<string, unknown>
}

export function parseDocument(raw: string, format: Format): ContentDocument {
	if (isDataOnly(format)) {
		let parsed: unknown
		try {
			parsed = DATA_CODECS[format].parse(raw)
		} catch (cause) {
			throw new ContentParseError(format, cause)
		}
		return { data: asData(parsed, format), body: null }
	}

	try {
		const parsed = parseFrontmatter(raw)
		return {
			data: normalizeMetadata(parsed.data) as Record<string, unknown>,
			body: parsed.content,
		}
	} catch (cause) {
		throw new ContentParseError(format, cause)
	}
}

function isUnchanged(document: ContentDocument, source: ContentDocument) {
	return canonicalMetadata(document.data) === canonicalMetadata(source.data)
}

function serializeData(
	document: ContentDocument,
	format: DataOnlyFormat,
	original?: OriginalSource,
) {
	if (document.body !== null) {
		throw new Error(
			`A ${format} document has no Body, so it cannot be serialized with one`,
		)
	}
	// Data is the whole file here, so unchanged Data means unchanged bytes.
	if (original && isUnchanged(document, parseDocument(original.raw, format))) {
		return original.raw
	}
	// Every Format this repo writes ends in a newline; JSON.stringify never does
	// and YAML.stringify always does, so the rule lives here rather than in the
	// codecs.
	const stringified = DATA_CODECS[format].stringify(document.data)
	return stringified.endsWith("\n") ? stringified : `${stringified}\n`
}

function serializeProse(
	document: ContentDocument,
	format: Format,
	original?: OriginalSource,
) {
	const body = document.body ?? ""

	if (original) {
		const source = parseDocument(original.raw, format)
		if (isUnchanged(document, source)) {
			// Everything up to where the Body starts is the writer's frontmatter
			// block, verbatim — whitespace, key order, comments and all. Their bytes
			// stand; only the Body is replaced. gray-matter's content is a literal
			// suffix of its input, so this slice is exact for CRLF, empty
			// frontmatter and absent frontmatter alike.
			const block = original.raw.slice(
				0,
				original.raw.length - (source.body ?? "").length,
			)
			return `${block}${body}`
		}
	}

	// gray-matter emits a bare body for empty Data, which is what a document
	// with nothing to say in its frontmatter should look like.
	return stringifyFrontmatter(body, document.data)
}

export function serializeDocument(
	document: ContentDocument,
	format: Format,
	original?: OriginalSource,
): string {
	return isDataOnly(format)
		? serializeData(document, format, original)
		: serializeProse(document, format, original)
}
