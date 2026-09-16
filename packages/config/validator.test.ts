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

// A nested Role used to skip every schema rule: a document validated cleanly and
// then threw at runtime, and a slug's source went unchecked.
describe("a Role nested in a Container", () => {
	const withField = (name: string, field: Record<string, unknown>) =>
		parse({
			collections: {
				pages: PAGES,
				posts: { ...POSTS, schema: { ...POSTS.schema, [name]: field } },
			},
		})
	const person = (fields: Record<string, unknown>) => ({
		items: [{ fields, label: "Person", type: "object" }],
		label: "People",
		type: "array",
	})

	it("refuses a document inside an object", () => {
		const { config, errors } = withField("group", {
			fields: { body: { label: "Body", type: "document" } },
			label: "Group",
			type: "object",
		})

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("collections.posts.schema.group.fields.body")
		expect(errors[0].message).toContain("top level")
		expect(Object.keys(config?.collections ?? {})).toEqual(["pages"])
	})

	it("refuses a document declared as an array item", () => {
		const { errors } = withField("sections", {
			items: [{ label: "Body", type: "document" }],
			label: "Sections",
			type: "array",
		})

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("collections.posts.schema.sections.items.0")
	})

	it("refuses a document in a json Collection once, not also for its Format", () => {
		const { errors } = parse({
			collections: {
				authors: {
					format: "json",
					label: "Authors",
					schema: {
						bio: {
							fields: { body: { label: "Body", type: "document" } },
							label: "Bio",
							type: "object",
						},
						name: { label: "Name", type: "text" },
						slug: { from: "name", label: "Slug", type: "slug" },
					},
				},
			},
		})

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("collections.authors.schema.bio.fields.body")
	})

	it("accepts a slug in a top-level object", () => {
		const { errors } = withField("author", {
			fields: {
				handle: { from: "name", label: "Handle", type: "slug" },
				name: { label: "Name", type: "text" },
			},
			label: "Author",
			type: "object",
		})

		expect(errors).toEqual([])
	})

	it("accepts a slug deriving from a text field beside it", () => {
		const { config, errors } = withField(
			"people",
			person({
				handle: { from: "name", label: "Handle", type: "slug" },
				name: { label: "Name", type: "text" },
			}),
		)

		expect(errors).toEqual([])
		expect(Object.keys(config?.collections ?? {})).toEqual(["pages", "posts"])
	})

	it("refuses a slug deriving from a field outside its object", () => {
		const { errors } = withField(
			"people",
			person({ handle: { from: "title", label: "Handle", type: "slug" } }),
		)

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe(
			"collections.posts.schema.people.items.0.fields.handle.from",
		)
	})

	it("refuses a slug deriving from a field that is not text", () => {
		const { errors } = withField(
			"people",
			person({
				born: { label: "Born", type: "date" },
				handle: { from: "born", label: "Handle", type: "slug" },
			}),
		)

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe(
			"collections.posts.schema.people.items.0.fields.handle.from",
		)
		expect(errors[0].message).toContain('"text"')
	})

	it("refuses a slug declared as an array item", () => {
		const { errors } = withField("handles", {
			items: [{ from: "title", label: "Handle", type: "slug" }],
			label: "Handles",
			type: "array",
		})

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("collections.posts.schema.handles.items.0")
	})

	it("refuses a document inside a Singleton too", () => {
		const { config, errors } = parse({
			collections: { posts: POSTS },
			singletons: {
				about: {
					format: "md",
					label: "About",
					schema: {
						group: {
							fields: { body: { label: "Body", type: "document" } },
							label: "Group",
							type: "object",
						},
					},
				},
			},
		})

		expect(errors).toHaveLength(1)
		expect(errors[0].path).toBe("singletons.about.schema.group.fields.body")
		expect(Object.keys(config?.singletons ?? {})).toEqual([])
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
