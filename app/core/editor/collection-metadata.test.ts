import { describe, expect, it } from "vitest"
import type { Field } from "@/config/types"
import {
	applyMetadataDefaults,
	canonicalMetadata,
	getCollectionEditorFields,
	getCompositeValue,
	normalizeMetadata,
	setCompositeValue,
	updateMetadataField,
	validateMetadata,
} from "./collection-metadata"

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
} as unknown as Record<string, Field>

describe("collection metadata", () => {
	it("applies recursive defaults and derives an editable slug", () => {
		expect(applyMetadataDefaults(schema, {})).toEqual({
			title: "Hello",
			slug: "hello",
			settings: { live: true },
			tags: [],
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

	it("compares records independent of key order", () => {
		expect(canonicalMetadata({ b: 2, a: 1 })).toBe(
			canonicalMetadata({ a: 1, b: 2 }),
		)
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
		])
	})

	it("normalizes YAML dates before comparison and transport", () => {
		expect(
			normalizeMetadata({
				published: new Date("2026-07-14T00:00:00.000Z"),
			}),
		).toEqual({ published: "2026-07-14" })
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
})
