import { expect, test } from "vitest"
import {
	getCollectionPath,
	getDraftEditorPath,
	isDraftAdoptionNavigation,
} from "./draft-paths"

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

test("addresses the collection a draft belongs to", () => {
	expect(getCollectionPath(PROJECT, "posts")).toBe(
		"/acme/website/collections/posts",
	)
})

const NEW_ITEM_EDITOR =
	"https://kobun.test/acme/website/collections/posts/editor/new"

test("recognizes the editor adopting the draft its first save minted", () => {
	expect(
		isDraftAdoptionNavigation(
			new URL(NEW_ITEM_EDITOR),
			new URL(`${NEW_ITEM_EDITOR}?draft=draft-id`),
		),
	).toBe(true)
})

test("does not mistake a move between drafts for an adoption", () => {
	expect(
		isDraftAdoptionNavigation(
			new URL(`${NEW_ITEM_EDITOR}?draft=first`),
			new URL(`${NEW_ITEM_EDITOR}?draft=second`),
		),
	).toBe(false)
})

test("does not mistake a move to another item for an adoption", () => {
	expect(
		isDraftAdoptionNavigation(
			new URL(NEW_ITEM_EDITOR),
			new URL(
				"https://kobun.test/acme/website/collections/posts/editor/item/hello?draft=draft-id",
			),
		),
	).toBe(false)
})
