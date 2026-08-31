import { describe, expect, it } from "vitest"
import { managedFieldsFor } from "@/config/features"
import type { Features, ResolvedField } from "@/config/types"
import { deriveCreatedAt, deriveStatus, statusOptions } from "./collection-list"

/**
 * The authored half of a Collection that leans on the conventions: a `date` the
 * writer declared, and no `status` at all — the shape the key-sniffing exists
 * for.
 */
const AUTHORED = {
	date: { label: "Date", type: "date" },
	slug: { from: "title", label: "Slug", type: "slug" },
	title: { label: "Title", type: "text" },
} as unknown as Record<string, ResolvedField>

/**
 * A resolved schema, built through the real expansion so these tests read the
 * Managed Fields the config layer actually contributes rather than a copy that
 * can drift from it.
 */
const resolved = (features: Features): Record<string, ResolvedField> => ({
	...AUTHORED,
	...managedFieldsFor(features),
})

const TIMESTAMPS = resolved({ timestamps: { createdAt: true } })
const PUBLISH = resolved({ publish: true })

describe("deriveCreatedAt", () => {
	it("reads the Managed Field when the Collection opted in", () => {
		const at = deriveCreatedAt(TIMESTAMPS, {
			createdAt: "2026-03-04T09:00:00Z",
			date: "2020-01-01",
		})

		expect(at).toBe(Date.parse("2026-03-04T09:00:00Z"))
	})

	it("ignores the conventional keys once the Field is Managed", () => {
		expect(
			deriveCreatedAt(TIMESTAMPS, {
				date: "2020-01-01",
				publishedAt: "2021-01-01T00:00:00Z",
			}),
		).toBeUndefined()
	})

	// `timestamps.updatedAt` on its own contributes no `createdAt`, so the
	// Collection has not opted in as far as this column is concerned.
	it("falls back when only updatedAt is enabled", () => {
		const schema = resolved({ timestamps: { updatedAt: true } })

		expect(deriveCreatedAt(schema, { date: "2020-01-01" })).toBe(
			Date.parse("2020-01-01"),
		)
	})

	describe("with no Feature", () => {
		it("tries createdAt, then date, then publishedAt", () => {
			expect(deriveCreatedAt(AUTHORED, { createdAt: "2020-01-01" })).toBe(
				Date.parse("2020-01-01"),
			)
			expect(deriveCreatedAt(AUTHORED, { date: "2021-01-01" })).toBe(
				Date.parse("2021-01-01"),
			)
			expect(deriveCreatedAt(AUTHORED, { publishedAt: "2022-01-01" })).toBe(
				Date.parse("2022-01-01"),
			)
		})
	})

	// Both halves of the same answer: the row carries no timestamp, and the
	// column sorts it last rather than at an arbitrary end.
	it.each([
		["absent", {}],
		["null", { createdAt: null, date: null, publishedAt: null }],
		["unparseable", { createdAt: "not a date" }],
		["a non-value", { createdAt: {} }],
	])("is undefined when the value is %s", (_label, data) => {
		expect(deriveCreatedAt(TIMESTAMPS, data)).toBeUndefined()
		expect(deriveCreatedAt(AUTHORED, data)).toBeUndefined()
	})
})

describe("deriveStatus", () => {
	it("reads the Managed Field's options when the Collection opted in", () => {
		expect(deriveStatus(PUBLISH, { status: "draft" })).toBe("DRAFT")
		expect(deriveStatus(PUBLISH, { status: "published" })).toBe("PUBLISHED")
		expect(deriveStatus(PUBLISH, { status: "Draft" })).toBe("DRAFT")
	})

	// Opting in narrows: the declared Field offers no `scheduled` (ADR-0005).
	it("does not recognise a value the Managed Field does not offer", () => {
		expect(deriveStatus(PUBLISH, { status: "scheduled" })).toBe("PUBLISHED")
	})

	// Publication State never backfills, so a pre-existing Source legitimately
	// carries no `status`. Reading that as Draft would blank-slate a whole
	// Collection the moment its author turned the Feature on.
	it("is PUBLISHED when the Managed value is missing", () => {
		expect(deriveStatus(PUBLISH, {})).toBe("PUBLISHED")
	})

	it("ignores the conventional keys once the Field is Managed", () => {
		expect(deriveStatus(PUBLISH, { draft: true })).toBe("PUBLISHED")
		expect(deriveStatus(PUBLISH, { published: false })).toBe("PUBLISHED")
	})

	describe("with no Feature", () => {
		it("still sniffs the conventional keys", () => {
			expect(deriveStatus(AUTHORED, { status: "scheduled" })).toBe("SCHEDULED")
			expect(deriveStatus(AUTHORED, { draft: true })).toBe("DRAFT")
			expect(deriveStatus(AUTHORED, { published: false })).toBe("DRAFT")
			expect(deriveStatus(AUTHORED, { status: "archived" })).toBe("PUBLISHED")
			expect(deriveStatus(AUTHORED, {})).toBe("PUBLISHED")
		})
	})
})

describe("statusOptions", () => {
	it("offers what the Managed Field offers", () => {
		expect(statusOptions(PUBLISH)).toEqual([
			{ label: "Draft", value: "DRAFT" },
			{ label: "Published", value: "PUBLISHED" },
		])
	})

	it("offers the conventional three with no Feature", () => {
		expect(statusOptions(AUTHORED)).toEqual([
			{ label: "Published", value: "PUBLISHED" },
			{ label: "Draft", value: "DRAFT" },
			{ label: "Scheduled", value: "SCHEDULED" },
		])
	})
})
