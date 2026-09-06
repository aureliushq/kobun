import { managedField } from "@/config/features"
import type { ResolvedField } from "@/config/types"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import type { CommitAction, ResolvedSource } from "./types"

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
 * Publication State, as the act of publishing declares it.
 *
 * Clock-free and idempotent, which is what lets it be applied *before* the
 * matches-Source comparison: the transition is then itself the change that gets
 * committed, and a second Publish of an item already `published` compares equal
 * and commits nothing (ADR-0008).
 *
 * `status` is written by Publish and by nothing else, and Publish always writes
 * `published` — including onto a Source that has no `status` key, which #87
 * forbade. The fear that rule guarded against is closed by construction instead:
 * ordinary editing goes through Save to GitHub, which never touches `status`, so
 * a typo fix cannot unpublish anything whatever the Source carries.
 */
export function withPublishedStatus(
	schema: ResolvedSchema,
	fields: FieldRecord,
): FieldRecord {
	if (!isManaged(schema, "status")) return fields
	return { ...fields, status: "published" }
}

/**
 * The timestamps the system writes as a Draft reaches its Source. Nothing here
 * ever discards what the writer typed: the two write-once values keep one they
 * already have, and `updatedAt` keeps one the writer moved off the Source's.
 *
 * Observational rather than declarative, so these land *after* the comparison
 * has decided there is a change, and before the Draft is persisted — see
 * `commitResolved`. The other way round, a Draft that survives the commit would
 * hold values its Source lacks, the comparison would never match again, and
 * every later commit would write a fresh timestamp forever (ADR-0005, #87).
 *
 * The keys are the ones `MANAGED_FIELDS` contributes (`packages/config`): a
 * Feature that adds a fifth Field needs its rule here too.
 */
export function stampTimestamps({
	action,
	fields,
	now,
	schema,
	source,
}: {
	action: CommitAction
	fields: FieldRecord
	now: Date
	schema: ResolvedSchema
	source: ResolvedSource | null
}): FieldRecord {
	const stamped = { ...fields }
	const instant = now.toISOString()

	// Write-once, and backfilled onto a Source that predates the Feature: each
	// records a moment in the file's life Kobun was present for. "Already set" is
	// about the value being committed, not the one the Source holds, so a writer
	// who clears the field is asking for it to be stamped again.
	//
	// `publishedAt` is a fact about publication, so only the action that publishes
	// may write it: a Save to GitHub leaves it exactly as it found it (ADR-0008).
	const writeOnce =
		action === "publish" ? ["createdAt", "publishedAt"] : ["createdAt"]
	for (const key of writeOnce) {
		if (isManaged(schema, key) && isUnset(stamped[key])) stamped[key] = instant
	}

	// A fact about when the bytes changed, so it advances on every commit —
	// including the first, and whichever action committed — unless the writer set
	// it themselves.
	if (
		isManaged(schema, "updatedAt") &&
		!isEdited(stamped.updatedAt, source?.frontmatter.updatedAt)
	) {
		stamped.updatedAt = instant
	}

	return stamped
}
