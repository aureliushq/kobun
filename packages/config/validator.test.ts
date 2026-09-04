import { describe, expect, it } from "vitest"

import { validateConfig } from "./validator"

const POSTS = {
	format: "md",
	label: "Posts",
	schema: {
		content: { label: "Content", type: "document" },
		slug: { from: "title", label: "Slug", type: "slug" },
		title: { label: "Title", type: "text" },
	},
}

const PAGES = { ...POSTS, label: "Pages" }

const parse = (config: Record<string, unknown>) =>
	validateConfig(JSON.stringify({ version: 1, ...config }), "json")

describe("features on a Collection", () => {
	// `timestamps` was the only non-optional key of the feature block, so a
	// Config that wanted publish alone failed validation.
	it("accepts publish with no timestamps key", () => {
		const { config, errors } = parse({
			collections: { posts: { ...POSTS, features: { publish: true } } },
		})

		expect(errors).toEqual([])
		expect(Object.keys(config?.collections.posts.schema ?? {})).toContain(
			"status",
		)
	})

	it("puts the Feature's Fields into the resolved schema", () => {
		const { config } = parse({
			collections: {
				posts: {
					...POSTS,
					features: { publish: true, timestamps: { createdAt: true } },
				},
			},
		})

		expect(config?.collections.posts.schema).toMatchObject({
			createdAt: { label: "Created", managed: true, type: "datetime" },
			publishedAt: { label: "Published", managed: true, type: "datetime" },
			status: { label: "Status", managed: true, type: "select" },
		})
	})

	it("leaves a Collection with no Features untouched", () => {
		const { config } = parse({ collections: { posts: POSTS } })

		expect(Object.keys(config?.collections.posts.schema ?? {})).toEqual([
			"content",
			"slug",
			"title",
		])
	})
})

describe("a Field colliding with a Feature", () => {
	const collision = () =>
		parse({
			collections: {
				pages: PAGES,
				posts: {
					...POSTS,
					features: { timestamps: { createdAt: true } },
					schema: {
						...POSTS.schema,
						createdAt: { label: "Written on", type: "date" },
					},
				},
			},
		})

	it("reports an error scoped to the Collection that has it", () => {
		const { errors } = collision()

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("collections.posts.schema.createdAt")
		expect(errors[0].message).toContain("timestamps.createdAt")
	})

	// One bad Collection must not blank a whole Config.
	it("still loads the other Collections", () => {
		const { config } = collision()

		expect(Object.keys(config?.collections ?? {})).toEqual(["pages"])
	})
})

describe("features on a Singleton", () => {
	const rejected = () =>
		parse({
			collections: { posts: POSTS },
			singletons: {
				about: {
					features: { publish: true },
					format: "md",
					label: "About",
					schema: { content: { label: "Content", type: "document" } },
				},
			},
		})

	it("is a config error explaining it is not supported there", () => {
		const { errors } = rejected()

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("singletons.about.features")
		expect(errors[0].message).toContain("not supported on Singletons")
	})

	it("leaves the rest of the Config loading", () => {
		const { config } = rejected()

		expect(Object.keys(config?.singletons ?? {})).toEqual([])
		expect(Object.keys(config?.collections ?? {})).toEqual(["posts"])
	})
})

// The marker is the config layer's own output, so it is absent from the Zod
// schema and Zod strips it like any other unknown key (ADR-0005).
it("ignores a managed marker a Config writes itself", () => {
	const { config, errors } = parse({
		collections: {
			posts: {
				...POSTS,
				schema: {
					...POSTS.schema,
					title: { label: "Title", managed: true, type: "text" },
				},
			},
		},
	})

	expect(errors).toEqual([])
	expect(config?.collections.posts.schema.title).not.toHaveProperty("managed")
})

// A Config that declares nothing parses to `null`, and `null` is all the caller
// gets — so every way of reaching it has to leave a reason behind, or the
// dashboard is left inventing one (ADR-0003 amendment).
describe("a Config that declares nothing", () => {
	it("says so when the collections map is empty", () => {
		const { config, errors } = parse({ collections: {} })

		expect(config).toBeNull()
		expect(errors).toHaveLength(1)
		expect(errors[0].code).toBe("no_collections")
		expect(errors[0].path).toBe("collections")
	})

	// `YAML.parse` answers an empty document with `null`, and reading `basePath`
	// off that threw a TypeError past every caller but the one that happened to
	// wrap it.
	it("reports an empty YAML file rather than throwing", () => {
		const { config, errors } = validateConfig("", "yaml")

		expect(config).toBeNull()
		expect(errors).toHaveLength(1)
		expect(errors[0].code).toBe("parse_error")
	})

	it("reports a file that is not an object at all", () => {
		const { config, errors } = validateConfig('"just a string"', "json")

		expect(config).toBeNull()
		expect(errors[0].code).toBe("parse_error")
	})
})
