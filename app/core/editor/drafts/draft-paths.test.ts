import { expect, test } from "vitest"
import { getDraftEditorPath } from "./draft-paths"

const PROJECT = { repoName: "website", repoOwnerLogin: "acme" }

test("addresses an unpublished draft by its own id", () => {
	expect(
		getDraftEditorPath(
			{
				collectionSlug: "posts",
				id: "draft-id",
				itemSlug: null,
				sourcePath: null,
			},
			PROJECT,
		),
	).toBe("/acme/website/collections/posts/editor/new?draft=draft-id")
})

test("addresses a source-backed draft by the item it belongs to", () => {
	expect(
		getDraftEditorPath(
			{
				collectionSlug: "posts",
				id: "draft-id",
				itemSlug: "hello world",
				sourcePath: "content/posts/hello-world.md",
			},
			PROJECT,
		),
	).toBe("/acme/website/collections/posts/editor/item/hello%20world")
})
