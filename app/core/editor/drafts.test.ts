import { describe, expect, it } from "vitest"
import {
	getDraftEditorPath,
	isDraftDirty,
	isPublishedDraftSynced,
} from "./drafts"

describe("editor draft lifecycle", () => {
	it("keeps unpublished and newer revisions dirty", () => {
		expect(isDraftDirty({ revision: 0, publishedRevision: null })).toBe(true)
		expect(isDraftDirty({ revision: 3, publishedRevision: 2 })).toBe(true)
	})

	it("recognizes a published revision as synced", () => {
		expect(isDraftDirty({ revision: 3, publishedRevision: 3 })).toBe(false)
	})

	it("only cleans up revisions that were actually published and remain synced", () => {
		const publishedAt = new Date("2026-01-01")
		expect(
			isPublishedDraftSynced({
				revision: 3,
				publishedRevision: 3,
				publishedAt,
			}),
		).toBe(true)
		expect(
			isPublishedDraftSynced({
				revision: 4,
				publishedRevision: 3,
				publishedAt,
			}),
		).toBe(false)
		expect(
			isPublishedDraftSynced({
				revision: 0,
				publishedRevision: null,
				publishedAt: null,
			}),
		).toBe(false)
	})

	it("builds project routes without repository data on the draft row", () => {
		expect(
			getDraftEditorPath(
				{
					id: "draft-id",
					collectionSlug: "posts",
					itemSlug: null,
					sourcePath: null,
				},
				{ repoOwnerLogin: "acme", repoName: "website" },
			),
		).toBe("/acme/website/collections/posts/editor/new?draft=draft-id")

		expect(
			getDraftEditorPath(
				{
					id: "draft-id",
					collectionSlug: "posts",
					itemSlug: "hello world",
					sourcePath: "content/posts/hello-world.md",
				},
				{ repoOwnerLogin: "acme", repoName: "website" },
			),
		).toBe("/acme/website/collections/posts/editor/item/hello%20world")
	})
})
