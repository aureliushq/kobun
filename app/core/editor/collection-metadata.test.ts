import { describe, expect, it } from "vitest"
import type { Field } from "@/config/types"
import {
	applyMetadataDefaults,
	defaultFieldValue,
	getCollectionEditorFields,
	getCompositeValue,
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

/**
 * One Field of every Field Type, plus the Slug Role. `date`, `url` and `image`
 * default to an empty string only because the old switch had no case for them;
 * these tests pin that so the registry inherits the behavior deliberately.
 */
const everyType = {
	name: { type: "text", label: "Name", defaultValue: "Ada" },
	link: { type: "url", label: "Link" },
	published: { type: "date", label: "Published" },
	live: { type: "boolean", label: "Live" },
	cover: { type: "image", label: "Cover" },
	tier: {
		type: "select",
		label: "Tier",
		options: [
			{ label: "Free", value: "free" },
			{ label: "Pro", value: "pro" },
		],
		defaultSelected: { label: "Pro", value: "pro" },
	},
	tags: {
		type: "multi_select",
		label: "Tags",
		options: [
			{ label: "One", value: "one" },
			{ label: "Two", value: "two" },
		],
		defaultSelected: [{ label: "One", value: "one" }],
	},
	people: {
		type: "array",
		label: "People",
		items: [{ type: "text", label: "Name" }],
	},
	settings: {
		type: "object",
		label: "Settings",
		fields: { live: { type: "boolean", label: "Live", defaultValue: true } },
	},
	handle: { type: "slug", label: "Handle", from: "name" },
} as unknown as Record<string, Field>

describe("field type defaults", () => {
	it("defaults every field type", () => {
		expect(applyMetadataDefaults(everyType, {})).toEqual({
			name: "Ada",
			link: "",
			published: "",
			live: false,
			cover: "",
			tier: "pro",
			tags: ["one"],
			people: [],
			settings: { live: true },
			handle: "ada",
		})
	})

	it("defaults a slug field to an empty string before derivation", () => {
		expect(
			defaultFieldValue({
				type: "slug",
				label: "Handle",
				from: "name",
			} as unknown as Field),
		).toBe("")
	})

	it("defaults an object through its own schema, deriving nested slugs", () => {
		const schema = {
			group: {
				type: "object",
				label: "Group",
				fields: {
					name: { type: "text", label: "Name", defaultValue: "Ada" },
					handle: { type: "slug", label: "Handle", from: "name" },
					body: { type: "document", label: "Body" },
				},
			},
		} as unknown as Record<string, Field>
		expect(applyMetadataDefaults(schema, {})).toEqual({
			group: { name: "Ada", handle: "ada" },
		})
	})
})

describe("field type validation", () => {
	it("accepts a well-formed value of every field type", () => {
		expect(
			validateMetadata(everyType, {
				name: "Ada",
				link: "https://example.com",
				published: "2026-08-28",
				live: true,
				cover: "/ada.png",
				tier: "pro",
				tags: ["one"],
				people: ["Ada"],
				settings: { live: true },
				handle: "ada",
			}),
		).toEqual([])
	})

	it("reports a malformed value of every field type", () => {
		expect(
			validateMetadata(everyType, {
				name: 42,
				link: "not a url",
				published: "2026-13-99",
				live: "yes",
				cover: 7,
				tier: "gold",
				tags: ["three"],
				people: "Ada",
				settings: "live",
				handle: 3,
			}),
		).toEqual([
			"Name must be text",
			"Link must be a valid URL",
			"Published must be a valid date",
			"Live must be a boolean",
			"Cover must be text",
			"Tier is not a valid option",
			"Tags contains an invalid option",
			"People must be an array",
			"Settings must be an object",
			"Handle must be text",
		])
	})

	it("skips an empty value that is not required", () => {
		expect(
			validateMetadata(everyType, {
				name: "",
				link: "",
				published: "",
				live: undefined,
				cover: "",
				tier: "",
				tags: [],
				people: [],
				settings: null,
				handle: "",
			}),
		).toEqual([])
	})

	it("rejects a multi_select that is not a list of strings", () => {
		expect(validateMetadata(everyType, { tags: [1] })).toEqual([
			"Tags must be a list of options",
		])
	})

	it("paths array errors by index, and composite rows by item label", () => {
		const schema = {
			crew: {
				type: "array",
				label: "Crew",
				items: [
					{ type: "text", label: "Name" },
					{ type: "image", label: "Avatar", required: true },
				],
			},
		} as unknown as Record<string, Field>
		expect(validateMetadata(schema, { crew: [["Ada", "/ada.png"]] })).toEqual(
			[],
		)
		expect(validateMetadata(schema, { crew: ["Ada"] })).toEqual([
			"Crew[0] must be a row",
		])
		expect(validateMetadata(schema, { crew: [{ Name: 1 }] })).toEqual([
			"Crew[0].Name must be text",
			"Crew[0].Avatar is required",
		])
		expect(validateMetadata(everyType, { people: [1] })).toEqual([
			"People[0] must be text",
		])
	})

	it("reports required children of an object that is present but empty", () => {
		const schema = {
			settings: {
				type: "object",
				label: "Settings",
				fields: { name: { type: "text", label: "Name", required: true } },
			},
		} as unknown as Record<string, Field>
		expect(validateMetadata(schema, { settings: {} })).toEqual([
			"Settings.Name is required",
		])
	})

	it("validates a document nested in an object but skips one at the top level", () => {
		const schema = {
			body: { type: "document", label: "Body" },
			group: {
				type: "object",
				label: "Group",
				fields: { body: { type: "document", label: "Body" } },
			},
		} as unknown as Record<string, Field>
		expect(validateMetadata(schema, { body: 1, group: { body: 1 } })).toEqual([
			"Group.Body must be text",
		])
	})
})
