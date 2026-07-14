import { describe, expect, it } from "vitest"
import {
	collectionItemBodyMatches,
	findCollectionItemBySlug,
	isMarkdownCollectionFile,
	serializeCollectionItem,
} from "./collection-items.server"

const collection = {
	format: "md",
	schema: {
		title: { type: "text" },
		slug: { type: "slug", from: "title" },
	},
}

describe("collection item resolution", () => {
	it("detects an unchanged Markdown body without involving its source prefix", () => {
		expect(collectionItemBodyMatches({ body: "Hello\n" }, "Hello\n")).toBe(true)
		expect(collectionItemBodyMatches({ body: "Hello\n" }, "Hello")).toBe(false)
	})
	it("accepts both Markdown extensions", () => {
		expect(isMarkdownCollectionFile({ name: "post.md" })).toBe(true)
		expect(isMarkdownCollectionFile({ name: "post.mdx" })).toBe(true)
		expect(isMarkdownCollectionFile({ name: "post.json" })).toBe(false)
	})

	it("matches the configured frontmatter slug and returns the markdown body", () => {
		const item = findCollectionItemBySlug(
			collection,
			[
				{
					name: "different-file-name.md",
					path: "content/posts/different-file-name.md",
					sha: "sha-1",
					content: "---\ntitle: Hello\nslug: hello-world\n---\nBody text\n",
				},
			],
			"hello-world",
		)

		expect(item).toMatchObject({
			body: "Body text\n",
			itemSlug: "hello-world",
			path: "content/posts/different-file-name.md",
			sha: "sha-1",
		})
	})

	it("falls back to the filename when frontmatter has no slug", () => {
		const item = findCollectionItemBySlug(
			collection,
			[
				{
					name: "filename-slug.md",
					path: "content/posts/filename-slug.md",
					sha: "sha-2",
					content: "---\ntitle: Hello\n---\nBody\n",
				},
			],
			"filename-slug",
		)

		expect(item?.itemSlug).toBe("filename-slug")
	})

	it("rejects duplicate effective slugs", () => {
		expect(() =>
			findCollectionItemBySlug(
				collection,
				[
					{
						name: "one.md",
						path: "content/posts/one.md",
						sha: "sha-1",
						content: "---\nslug: duplicate\n---\nOne\n",
					},
					{
						name: "two.md",
						path: "content/posts/two.md",
						sha: "sha-2",
						content: "---\nslug: duplicate\n---\nTwo\n",
					},
				],
				"duplicate",
			),
		).toThrow('Multiple collection items use slug "duplicate"')
	})

	it("serializes edited markdown without losing frontmatter", () => {
		const source =
			'---\r\n# keep this comment\r\ntitle: "Hello"\r\ntags: [one, two]\r\n---\r\nOriginal body\r\n'
		const item = findCollectionItemBySlug(
			collection,
			[
				{
					name: "hello-world.md",
					path: "content/posts/hello-world.md",
					sha: "sha",
					content: source,
				},
			],
			"hello-world",
		)
		const serialized = serializeCollectionItem(
			"Updated body\n",
			item?.sourcePrefix ?? "",
		)

		expect(serialized).toBe(
			'---\r\n# keep this comment\r\ntitle: "Hello"\r\ntags: [one, two]\r\n---\r\nUpdated body\n',
		)
	})
})
