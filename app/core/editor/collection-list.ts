import { managedField } from "@/config/features"
import type { ResolvedField } from "@/config/types"

/**
 * The Publication States the list can show. `SCHEDULED` is a convention rather
 * than a Feature: a Managed `status` Field does not offer it, so opting in
 * narrows the vocabulary (ADR-0005).
 */
export type Status = "DRAFT" | "PUBLISHED" | "SCHEDULED"

export type StatusOption = { label: string; value: Status }

type ResolvedSchema = Record<string, ResolvedField>

const CONVENTIONAL_STATUSES: StatusOption[] = [
	{ label: "Published", value: "PUBLISHED" },
	{ label: "Draft", value: "DRAFT" },
	{ label: "Scheduled", value: "SCHEDULED" },
]

/** One of the three the list knows how to render. */
function isStatus(value: unknown): value is Status {
	return CONVENTIONAL_STATUSES.some((option) => option.value === value)
}

/**
 * The statuses this Collection's list offers: the Managed Field's own options
 * when `publish` is on, the conventional three otherwise. An option outside
 * those three has no badge to render, so it is left out rather than cast into
 * a `Status` it is not.
 */
export function statusOptions(schema: ResolvedSchema): StatusOption[] {
	const field = managedField(schema, "status")
	if (field?.type !== "select") return CONVENTIONAL_STATUSES
	return field.options.flatMap(({ label, value }) => {
		const status = value.toUpperCase()
		return isStatus(status) ? [{ label, value: status }] : []
	})
}

/**
 * A Collection Item's Publication State.
 *
 * An unrecognised value reads as `PUBLISHED` whether the Field is Managed or
 * guessed at. Publication State never backfills, so a Source that predates the
 * Feature legitimately carries no `status` — reading that as a Draft would take
 * a whole Collection of live posts off the shelf the moment its author turned
 * the Feature on.
 */
export function deriveStatus(
	schema: ResolvedSchema,
	data: Record<string, unknown>,
): Status {
	const raw = typeof data.status === "string" ? data.status.toUpperCase() : null

	if (managedField(schema, "status")) {
		const offered = statusOptions(schema).find(({ value }) => value === raw)
		return offered?.value ?? "PUBLISHED"
	}

	if (isStatus(raw)) return raw
	if (data.draft === true) return "DRAFT"
	if (data.published === false) return "DRAFT"
	return "PUBLISHED"
}

/**
 * When a Collection Item was created, in milliseconds — or `undefined` when it
 * has no such moment to sort on, whether the value is missing or unparseable.
 * The column sorts those last in either direction rather than at whichever end
 * the comparator happens to leave them.
 */
export function deriveCreatedAt(
	schema: ResolvedSchema,
	data: Record<string, unknown>,
): number | undefined {
	const candidate = managedField(schema, "createdAt")
		? data.createdAt
		: (data.createdAt ?? data.date ?? data.publishedAt)
	if (candidate == null) return undefined

	const at = new Date(candidate as string | number | Date).getTime()
	return Number.isNaN(at) ? undefined : at
}
