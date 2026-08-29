import { describe, expect, it } from "vitest"

import { expandFeatures, managedFieldsFor } from "./features"
import { collectionSchema } from "./schema"
import type { AuthoredCollection, Features } from "./types"

/**
 * A Collection parsed through the real schema so the fixture cannot drift from
 * a legal Config. Tests layer a `features` block and any extra Fields on top
 * rather than restating the whole thing.
 */
const authored = (
	features?: Features,
	extraFields: Record<string, unknown> = {},
): AuthoredCollection =>
	collectionSchema.parse({
		...(features ? { features } : {}),
		format: "md",
		label: "Posts",
		schema: {
			content: { label: "Content", type: "document" },
			slug: { from: "title", label: "Slug", type: "slug" },
			title: { label: "Title", type: "text" },
			...extraFields,
		},
	})

const expand = (features?: Features) => {
	const { collection, errors } = expandFeatures(authored(features))
	expect(errors).toEqual([])
	if (!collection) throw new Error("expected the Collection to expand")
	return collection
}

describe("managedFieldsFor", () => {
	it("contributes nothing when no Feature is enabled", () => {
		expect(managedFieldsFor(undefined)).toEqual({})
		expect(managedFieldsFor({})).toEqual({})
		expect(managedFieldsFor({ timestamps: {} })).toEqual({})
	})

	it("contributes nothing for a flag turned off", () => {
		expect(
			managedFieldsFor({ publish: false, timestamps: { createdAt: false } }),
		).toEqual({})
	})

	// `featured` is a constraint across a whole Collection, not a fact about the
	// item being edited, so it has no Field to contribute (ADR-0005).
	it("contributes nothing for featured", () => {
		expect(managedFieldsFor({ featured: { limit: 3 } })).toEqual({})
	})

	it.each([
		[
			"timestamps.createdAt",
			{ timestamps: { createdAt: true } } as Features,
			{ createdAt: { label: "Created", type: "datetime" } },
		],
		[
			"timestamps.updatedAt",
			{ timestamps: { updatedAt: true } } as Features,
			{ updatedAt: { label: "Last updated", type: "datetime" } },
		],
		[
			"publish",
			{ publish: true } as Features,
			{
				publishedAt: { label: "Published", type: "datetime" },
				status: { label: "Status", type: "select" },
			},
		],
	])("expands %s into its Fields", (_flag, features, expected) => {
		const fields = managedFieldsFor(features)

		expect(Object.keys(fields).sort()).toEqual(Object.keys(expected).sort())
		for (const [key, shape] of Object.entries(expected)) {
			expect(fields[key]).toMatchObject({ ...shape, managed: true })
		}
	})

	it("gives status the two Publication States, labelled", () => {
		const status = managedFieldsFor({ publish: true }).status

		expect(status).toMatchObject({
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Published", value: "published" },
			],
		})
	})

	// Nothing stamps these yet (#87), so a Managed Field is legitimately unset
	// during a publish. A required one would refuse every publish.
	it("marks no Managed Field required", () => {
		const fields = managedFieldsFor({
			publish: true,
			timestamps: { createdAt: true, updatedAt: true },
		})

		for (const field of Object.values(fields)) {
			expect(field.required).toBeUndefined()
		}
	})
})

describe("expandFeatures", () => {
	it("leaves a Collection with no Features exactly as authored", () => {
		expect(Object.keys(expand().schema)).toEqual(["content", "slug", "title"])
	})

	it("keeps the authored Fields alongside the Managed ones", () => {
		const { schema } = expand({
			publish: true,
			timestamps: { createdAt: true },
		})

		expect(Object.keys(schema).sort()).toEqual([
			"content",
			"createdAt",
			"publishedAt",
			"slug",
			"status",
			"title",
		])
		expect(schema.title).toEqual({ label: "Title", type: "text" })
	})

	it("marks only the contributed Fields as managed", () => {
		const { schema } = expand({ timestamps: { createdAt: true } })

		expect(schema.createdAt).toMatchObject({ managed: true })
		expect(schema.title).not.toHaveProperty("managed")
	})

	it("names the key and the Feature when a declared Field collides", () => {
		const { collection: expanded, errors } = expandFeatures(
			authored(
				{ timestamps: { createdAt: true } },
				{ createdAt: { label: "Written on", type: "date" } },
			),
		)

		expect(expanded).toBeNull()
		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("schema.createdAt")
		expect(errors[0].message).toContain("createdAt")
		expect(errors[0].message).toContain("timestamps.createdAt")
	})

	it("reports every collision at once", () => {
		const collection = authored(
			{ publish: true },
			{
				publishedAt: { label: "Published on", type: "date" },
				status: { label: "State", type: "text" },
			},
		)

		expect(expandFeatures(collection).errors.map(({ path }) => path)).toEqual([
			"schema.publishedAt",
			"schema.status",
		])
	})

	// A key a Feature owns is only a collision when that Feature is on.
	it("accepts a declared Field whose key belongs to a Feature nobody enabled", () => {
		const { collection: expanded, errors } = expandFeatures(
			authored(
				{ timestamps: { updatedAt: true } },
				{ createdAt: { label: "Written on", type: "date" } },
			),
		)

		expect(errors).toEqual([])
		expect(expanded?.schema.createdAt).toEqual({
			label: "Written on",
			type: "date",
		})
	})
})
