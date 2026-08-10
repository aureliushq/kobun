import { describe, expect, it } from "vitest"
import {
	collectionFileFormat,
	findCollectionItemBySlug,
	isMarkdownCollectionFile,
} from "./collection-items.server"

const collection = {
	schema: {
		title: { type: "text" },
		slug: { type: "slug", from: "title" },
	},
}

describe("collection item resolution", () => {
	it("accepts both Markdown extensions", () => {
		expect(isMarkdownCollectionFile({ name: "post.md" })).toBe(true)
		expect(isMarkdownCollectionFile({ name: "post.mdx" })).toBe(true)
		expect(isMarkdownCollectionFile({ name: "post.json" })).toBe(false)
	})

	it("reads each file's Format from its extension", () => {
		expect(collectionFileFormat({ name: "post.md" })).toBe("md")
		expect(collectionFileFormat({ name: "post.mdx" })).toBe("mdx")
	})

	it("matches the configured frontmatter slug and returns the markdown body", () => {
		const content = "---\ntitle: Hello\nslug: hello-world\n---\nBody text\n"
		const item = findCollectionItemBySlug(
			collection,
			[
				{
					name: "different-file-name.md",
					path: "content/posts/different-file-name.md",
					sha: "sha-1",
					content,
				},
			],
			"hello-world",
		)

		expect(item).toMatchObject({
			body: "Body text\n",
			itemSlug: "hello-world",
			path: "content/posts/different-file-name.md",
			// Whoever publishes over this Source gets its bytes, not a derived
			// fidelity trick.
			raw: content,
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
})
