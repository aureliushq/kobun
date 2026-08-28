import { describe, expect, it } from "vitest"
import type { Field } from "@/config/types"
import {
	applyMetadataDefaults,
	getCollectionEditorFields,
	getCompositeValue,
	setCompositeValue,
	updateMetadataField,
	validateMetadata,
} from "./collection-metadata"

const publishedAt = { type: "datetime", label: "Published at" }

const schema = {
	title: {
		type: "text",
		label: "Title",
		required: true,
		defaultValue: "Hello",
	},
	slug: { type: "slug", label: "Slug", from: "title", required: true },
	settings: {
		type: "object",
		label: "Settings",
		fields: { live: { type: "boolean", label: "Live", defaultValue: true } },
	},
	tags: {
		type: "multi_select",
		label: "Tags",
		options: [{ label: "One", value: "one" }],
	},
	publishedAt,
} as unknown as Record<string, Field>

/** A datetime on its own, so no unrelated required field contributes an error. */
const datetimeSchema = { publishedAt } as unknown as Record<string, Field>

function datetimeErrors(value: unknown) {
	return validateMetadata(datetimeSchema, { publishedAt: value })
}

const dateSchema = {
	publishedOn: { type: "date", label: "Published on" },
} as unknown as Record<string, Field>

function dateErrors(value: unknown) {
	return validateMetadata(dateSchema, { publishedOn: value })
}

describe("collection metadata", () => {
	it("applies recursive defaults and derives an editable slug", () => {
		expect(applyMetadataDefaults(schema, {})).toEqual({
			title: "Hello",
			slug: "hello",
			settings: { live: true },
			tags: [],
			publishedAt: "",
		})
		expect(applyMetadataDefaults(schema, { slug: "kept" }).slug).toBe("kept")
		expect(
			updateMetadataField(
				schema,
				{ title: "Hello", slug: "hello" },
				"title",
				"Hello Again",
			),
		).toMatchObject({ title: "Hello Again", slug: "hello-again" })
		expect(
			updateMetadataField(
				schema,
				{ title: "Hello", slug: "custom" },
				"title",
				"Hello Again",
			),
		).toMatchObject({ title: "Hello Again", slug: "custom" })
	})

	it("separates title and content from sidebar metadata", () => {
		const editorFields = getCollectionEditorFields({
			...schema,
			content: {
				type: "document",
				label: "Content",
			} as unknown as Field,
		})
		expect(editorFields.titleKey).toBe("title")
		expect(editorFields.documentKey).toBe("content")
		expect(editorFields.sidebarFields.map(([key]) => key)).toEqual([
			"slug",
			"settings",
			"tags",
			"publishedAt",
		])
	})

	it("preserves tuple and label-keyed composite array rows", () => {
		const name = { type: "text", label: "Name" } as Field
		const image = { type: "image", label: "Image" } as Field
		const tuple = ["Ada", "/ada.png"]
		const updatedTuple = setCompositeValue(tuple, name, 0, "Grace")
		expect(updatedTuple).toEqual(["Grace", "/ada.png"])
		expect(Array.isArray(updatedTuple)).toBe(true)

		const record = { Name: "Ada", Image: "/ada.png", extra: true }
		const updatedRecord = setCompositeValue(record, image, 1, "/grace.png")
		expect(updatedRecord).toEqual({
			Name: "Ada",
			Image: "/grace.png",
			extra: true,
		})
		expect(getCompositeValue(updatedRecord, image, 1)).toBe("/grace.png")
	})

	it("validates required and nested option values", () => {
		expect(
			validateMetadata(schema, {
				title: "",
				slug: "",
				settings: { live: "yes" },
				tags: ["bad"],
			}),
		).toEqual([
			"Title is required",
			"Slug is required",
			"Settings.Live must be a boolean",
			"Tags contains an invalid option",
		])
	})

	it("accepts a well-formed date", () => {
		for (const value of ["2026-07-14", "2024-02-29", ""]) {
			expect(dateErrors(value)).toEqual([])
		}
	})

	// date-fns parses a lone date leniently, which is the contract now.
	it("accepts an unpadded date", () => {
		for (const value of ["2026-7-14", "2026-07-4"]) {
			expect(dateErrors(value)).toEqual([])
		}
	})

	it("rejects a date that is malformed or names a day its month lacks", () => {
		for (const value of [
			"2026-02-30",
			"2026-04-31",
			"2025-02-29",
			"2026-13-01",
			"14/07/2026",
			"not a date",
		]) {
			expect(dateErrors(value)).toEqual(["Published on must be a valid date"])
		}
	})

	it("accepts a datetime carrying an explicit zone", () => {
		for (const value of [
			"2026-07-14T09:30:00.000Z",
			"2026-07-14T09:30:00Z",
			"2026-07-14T09:30Z",
			"2026-07-14T09:30:00+05:30",
			"2026-07-14T09:30:00.123456Z",
		]) {
			expect(datetimeErrors(value)).toEqual([])
		}
	})

	// The type holds an ISO-8601 instant, so every ISO spelling of one counts —
	// basic format, week dates and ordinal dates included.
	it("accepts the less common ISO spellings of an instant", () => {
		for (const value of [
			"20260714T093000Z",
			"2026-W27-1T09:30:00Z",
			"2026-186T09:30:00Z",
		]) {
			expect(datetimeErrors(value)).toEqual([])
		}
	})

	it("rejects a datetime that is malformed or missing its zone", () => {
		for (const value of [
			"2026-07-14",
			"2026-07-14T09:30",
			"2026-13-45T09:30:00Z",
			"yesterday",
		]) {
			expect(datetimeErrors(value)).toEqual([
				"Published at must be a valid date and time",
			])
		}
	})

	it("rejects a datetime naming a day its month does not have", () => {
		for (const value of [
			"2026-02-30T09:30:00Z",
			"2026-04-31T09:30:00Z",
			"2025-02-29T09:30:00Z",
		]) {
			expect(datetimeErrors(value)).toEqual([
				"Published at must be a valid date and time",
			])
		}
	})

	it("accepts a datetime on a real leap day", () => {
		expect(datetimeErrors("2024-02-29T09:30:00Z")).toEqual([])
	})

	it("accepts an empty datetime and defaults it to an empty string", () => {
		expect(datetimeErrors("")).toEqual([])
		expect(applyMetadataDefaults(schema, {}).publishedAt).toBe("")
	})
})
