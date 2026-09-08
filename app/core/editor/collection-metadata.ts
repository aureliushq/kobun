import type { Field, ResolvedField } from "@/config/types"
import {
	type DefaultForSchema,
	defaultForField,
	findSlugField,
	resolveTitleKey,
	validateField,
} from "@/core/fields"

export type FieldRecord = Record<string, unknown>

/**
 * How the registry's Container entries default their children. It is supplied
 * from here rather than derived in the registry because defaulting a schema
 * carries Role rules — a Document key is omitted entirely, a Slug is derived
 * from its source Field — and Roles are this module's business, not a Field
 * Type's.
 */
const defaultForSchema: DefaultForSchema = (schema) =>
	applyMetadataDefaults(schema, {})

export function defaultFieldValue(field: Field): unknown {
	return defaultForField(field, defaultForSchema)
}

export function applyMetadataDefaults(
	schema: Record<string, Field>,
	values: FieldRecord,
): FieldRecord {
	const result = { ...values }
	for (const [key, field] of Object.entries(schema)) {
		if (field.type === "document") continue
		if (result[key] === undefined)
			result[key] = defaultForField(field, defaultForSchema)
	}
	for (const [key, field] of Object.entries(schema)) {
		if (field.type !== "slug" || String(result[key] ?? "").trim()) continue
		result[key] = slugify(String(result[field.from] ?? ""))
	}
	return result
}

/**
 * How long a Slug may be. The ceiling is readability rather than the filesystem,
 * which would allow far more: a Slug is read in a URL bar, where a headline fits
 * and a paragraph does not.
 */
export const SLUG_MAX_LENGTH = 120

/**
 * What a Slug may be spelled with: lowercase letters and digits, in groups
 * joined by single hyphens. Module-private because this rule having been written
 * twice is the bug it exists to close — a caller asks `slugify` what a title
 * derives to, or `validateSlug` why a Slug was refused, and a third reader of
 * the pattern itself would be a third place for it to drift.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const SLUG_REQUIRED =
	"Slug is required — it becomes the file's name. A title with no letters or digits derives none, so type one."

const SLUG_MALFORMED =
	"Slug must be lowercase letters and numbers separated by single hyphens"

const SLUG_TOO_LONG = `Slug must be ${SLUG_MAX_LENGTH} characters or fewer`

/**
 * The Slug a source Field derives to.
 *
 * NFKD splits an accented letter into the letter and its mark so the mark can be
 * dropped and the letter kept. Without that step neither half is `[a-z0-9]`, and
 * `Héllo` breaks into two words instead of losing an accent.
 *
 * A title left with no letters or digits at all — one written entirely in
 * another script, or in punctuation — derives to nothing. That is deliberate:
 * `validateSlug` then asks the writer to name the item, rather than handing them
 * a generated Slug they would have to decipher and every such item the same one.
 */
export function slugify(value: string) {
	const slug = value
		.normalize("NFKD")
		.replace(/\p{M}+/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
	return slug.length <= SLUG_MAX_LENGTH ? slug : truncateToWord(slug)
}

/**
 * Cut an over-long Slug back to a whole word: a cut mid-word leaves a fragment
 * the reader has to finish before they recognise it. A single word longer than
 * the cap has no boundary to prefer, so it is cut at the cap.
 */
function truncateToWord(slug: string) {
	const cut = slug.slice(0, SLUG_MAX_LENGTH)
	// The word ended exactly at the cap, so there is nothing to give up.
	if (slug[SLUG_MAX_LENGTH] === "-") return cut
	const boundary = cut.lastIndexOf("-")
	// `cut` never begins with a hyphen, so this cannot empty the Slug.
	return boundary === -1 ? cut : cut.slice(0, boundary)
}

/**
 * Why this Slug cannot name a file, or nothing when it can.
 *
 * Empty and malformed are separate sentences because they are separate
 * mistakes: one writer has not named the item, the other has named it something
 * Kobun cannot use, and only the second needs to be told the alphabet. Where
 * both remaining reasons hold they are returned together, for the same reason
 * the commit gates are — a writer should see every problem at once rather than
 * one per attempt.
 *
 * Uniqueness is not here. Whether another item already answers to this Slug is
 * a question about the repository's listing rather than about the string, and
 * `isSlugTaken` in the drafts module asks it once this has passed.
 *
 * The value arrives trimmed, so it is not trimmed again.
 */
export function validateSlug(slug: string): string[] {
	if (slug === "") return [SLUG_REQUIRED]
	const errors: string[] = []
	if (!SLUG_PATTERN.test(slug)) errors.push(SLUG_MALFORMED)
	if (slug.length > SLUG_MAX_LENGTH) errors.push(SLUG_TOO_LONG)
	return errors
}

export function updateMetadataField(
	schema: Record<string, Field>,
	current: FieldRecord,
	key: string,
	value: unknown,
) {
	const next = { ...current, [key]: value }
	const slugField = findSlugField(schema)
	if (!slugField || slugField.field.from !== key) return next
	const slugKey = slugField.key
	const currentSlug = String(current[slugKey] ?? "")
	const previousDerivedSlug = slugify(String(current[key] ?? ""))
	if (!currentSlug || currentSlug === previousDerivedSlug) {
		next[slugKey] = slugify(String(value ?? ""))
	}
	return next
}

/**
 * Every Field's value against its own schema. A Document is skipped here and
 * only here: the Body is not a value, and the top level is the one place a
 * schema may legally declare one. A Document nested inside a Container reaches
 * the dispatcher instead and is refused loudly, so the skip is stated as what it
 * is rather than inferred from how deep the walk has gone.
 */
export function validateMetadata(
	schema: Record<string, Field>,
	values: FieldRecord,
): string[] {
	return Object.entries(schema).flatMap(([key, field]) =>
		field.type === "document"
			? []
			: validateField(field, values[key], field.label),
	)
}

export function getSlugField(schema: Record<string, Field>) {
	return findSlugField(schema)?.key ?? null
}

/**
 * The properties panel shows a Managed Field in its own group below a divider,
 * so the partition happens here rather than at the render site — both the
 * desktop panel and the mobile sheet read the same two lists.
 */
export function getCollectionEditorFields(
	schema: Record<string, ResolvedField>,
) {
	const entries = Object.entries(schema)
	const titleKey = resolveTitleKey(schema)
	const documentKey =
		entries.find(([, field]) => field.type === "document")?.[0] ?? null
	const sidebar = entries.filter(
		([key]) => key !== titleKey && key !== documentKey,
	)
	return {
		documentKey,
		managedFields: sidebar.filter(([, field]) => field.managed === true),
		sidebarFields: sidebar.filter(([, field]) => field.managed !== true),
		titleKey,
	}
}
