import { managedField } from "@/config/features"
import type { ResolvedField } from "@/config/types"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import type { ResolvedSource } from "./types"

type ResolvedSchema = Record<string, ResolvedField>

/** Whether the resolved schema says this key is the system's to stamp. */
function isManaged(schema: ResolvedSchema, key: string) {
	return managedField(schema, key) !== null
}

/** A value nobody has set: absent, null, or the empty string a Field defaults to. */
function isUnset(value: unknown) {
	return value == null || value === ""
}

/**
 * Whether the writer moved a value off the one the Source carries. Comparing
 * against the Source is what lets a stamp recognise an edit without any
 * dirty-tracking — and an unset value is unset however it is spelled, so a
 * Source that never had the key does not read as an edit.
 */
function isEdited(value: unknown, sourceValue: unknown) {
	if (isUnset(value) && isUnset(sourceValue)) return false
	return value !== sourceValue
}

/**
 * What a new item's Managed Fields hold before it has ever been published.
 *
 * `createdAt` goes into the content rather than onto the Draft row because a
 * Synced Draft is deleted — the row does not survive the publish that would
 * need it (ADR-0005). Idempotent, so opening the editor and minting the Draft
 * can both apply it. Only ever for a new item: an existing Source's creation
 * time is whatever it already carries.
 */
export function stampAtCreation({
	fields,
	now,
	schema,
}: {
	fields: FieldRecord
	now: Date
	schema: ResolvedSchema
}): FieldRecord {
	if (!isManaged(schema, "createdAt") || !isUnset(fields.createdAt)) {
		return fields
	}
	return { ...fields, createdAt: now.toISOString() }
}

/**
 * The inverse of `stampAtCreation`, for asking whether a new item holds any of
 * the writer's work: it drops exactly what that stamp put there and nothing
 * else. A writer who flips `status` or backdates `publishedAt` has written
 * something, and it survives the question.
 */
export function withoutCreationStamps(
	schema: ResolvedSchema,
	fields: FieldRecord,
): FieldRecord {
	if (!isManaged(schema, "createdAt")) return fields
	const rest = { ...fields }
	delete rest.createdAt
	return rest
}

/**
 * The values the system writes as a Draft reaches its Source. Nothing here ever
 * discards what the writer typed: the two write-once timestamps keep a value
 * they already have, and `updatedAt` keeps one the writer moved off the
 * Source's.
 *
 * Must be applied *before* the Draft is persisted, gated on a comparison
 * computed against unstamped values — see `publishResolved` (ADR-0005).
 *
 * The keys are the ones `MANAGED_FIELDS` contributes (`packages/config`): a
 * Feature that adds a fifth Field needs its rule here too.
 */
export function stampAtPublish({
	fields,
	now,
	schema,
	source,
}: {
	fields: FieldRecord
	now: Date
	schema: ResolvedSchema
	source: ResolvedSource | null
}): FieldRecord {
	const stamped = { ...fields }
	const instant = now.toISOString()

	// Write-once, and backfilled onto a Source that predates the Feature: each
	// records a moment in the file's life Kobun was present for. "Already set"
	// is about the value being committed, not the one the Source holds, so a
	// writer who clears the field is asking for it to be stamped again.
	for (const key of ["createdAt", "publishedAt"]) {
		if (isManaged(schema, key) && isUnset(stamped[key])) stamped[key] = instant
	}

	// A fact about when the bytes changed, so it advances on every publish —
	// including the first — unless the writer set it themselves.
	if (
		isManaged(schema, "updatedAt") &&
		!isEdited(stamped.updatedAt, source?.frontmatter.updatedAt)
	) {
		stamped.updatedAt = instant
	}

	// Publication State is the writer's intent about content Kobun may not have
	// authored, and there is no correct guess available: it is written only for
	// an Item Kobun is creating. Where the Source already exists it passes
	// through untouched — never added when absent, never overwritten when
	// present, whatever it says.
	//
	// Creating is the one place a writer's choice does not survive, because
	// until "Save to GitHub" exists every file Kobun commits is published by
	// construction, and a `draft` in the repository would be a lie (ADR-0005).
	if (isManaged(schema, "status") && source === null) {
		stamped.status = "published"
	}

	return stamped
}
