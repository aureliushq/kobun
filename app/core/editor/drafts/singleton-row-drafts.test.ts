import { afterEach, expect, test } from "vitest"
import { singletonSchema } from "@/config/schema"
import type { Singleton } from "@/config/types"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import { createSingletonRowDrafts } from "./singleton-row-drafts"
import {
	createSingletonDraftsTestHarness,
	type SingletonDraftsTestHarness,
	TEST_SINGLETON_PATH,
} from "./test-harness"

/**
 * One row of a Singleton's `array` Field, edited on its own page. The row has
 * no Source and no Draft of its own: every transition reads the Singleton's
 * Draft and writes the whole Singleton back, with the row at its position and
 * the Body as the Draft holds it (#94).
 */

const SINGLETON: Singleton = singletonSchema.parse({
	format: "md",
	label: "About",
	schema: {
		content: { label: "Content", type: "document" },
		links: {
			items: [
				{ label: "Label", type: "text" },
				{ label: "URL", type: "text" },
			],
			label: "Links",
			type: "array",
		},
		tags: {
			items: [{ label: "Tag", type: "text" }],
			label: "Tags",
			type: "array",
		},
		team: {
			items: [
				{
					fields: {
						name: { label: "Name", type: "text" },
						role: { label: "Role", type: "text" },
					},
					label: "Member",
					type: "object",
				},
			],
			label: "Team",
			type: "array",
		},
		title: { label: "Title", type: "text" },
	},
})

const SOURCE = `---
title: About
team:
  - name: Ada
    role: Engineer
  - name: Grace
    role: Admiral
tags:
  - one
  - two
links:
  - [Home, /]
  - Label: Blog
    URL: /blog
---
Our story.
`

let harness: SingletonDraftsTestHarness

function setup() {
	harness = createSingletonDraftsTestHarness({ singleton: SINGLETON })
	harness.sourceStore.put({ content: SOURCE, path: TEST_SINGLETON_PATH })
	return harness
}

/** The row editor a URL names, as the route builds it. */
function rowDrafts(fieldKey: string, itemIndex: string) {
	return createSingletonRowDrafts({
		drafts: harness.drafts,
		fieldKey,
		itemIndex,
		schema: SINGLETON.schema,
	})
}

afterEach(() => {
	harness?.close()
})

test("opens the row the URL counts to from one, as that row's Fields and no Body", async () => {
	setup()
	const row = rowDrafts("team", "2")

	expect(row?.schema).toEqual({
		name: { label: "Name", type: "text" },
		role: { label: "Role", type: "text" },
	})
	expect(await row?.open()).toEqual({
		content: "",
		dirty: false,
		draftId: null,
		fields: { name: "Grace", role: "Admiral" },
		revision: null,
	})
})

test("opens a row of one scalar item as that item's Field", async () => {
	setup()
	const row = rowDrafts("tags", "2")

	expect(row?.schema).toEqual({ Tag: { label: "Tag", type: "text" } })
	expect(await row?.open()).toMatchObject({ fields: { Tag: "two" } })
})

test("opens a composite row as one Field per item, whichever shape the row was written in", async () => {
	setup()

	expect(rowDrafts("links", "1")?.schema).toEqual({
		Label: { label: "Label", type: "text" },
		URL: { label: "URL", type: "text" },
	})
	expect(await rowDrafts("links", "1")?.open()).toMatchObject({
		fields: { Label: "Home", URL: "/" },
	})
	expect(await rowDrafts("links", "2")?.open()).toMatchObject({
		fields: { Label: "Blog", URL: "/blog" },
	})
})

test("a Field that is not an array, or a position that is not one, addresses no row", () => {
	setup()

	expect(rowDrafts("title", "1")).toBeNull()
	expect(rowDrafts("missing", "1")).toBeNull()
	expect(rowDrafts("team", "0")).toBeNull()
	expect(rowDrafts("team", "new")).toBeNull()
	expect(rowDrafts("team", "1.5")).toBeNull()
})

test("a position past the last row opens nothing", async () => {
	setup()

	expect(await rowDrafts("team", "3")?.open()).toBeNull()
})

test("a save keeps the Singleton's Draft with the row at its position and the Body as it was", async () => {
	setup()
	const row = rowDrafts("team", "2")

	const result = await row?.save({
		baseFields: { name: "Grace", role: "Admiral" },
		expectedRevision: null,
		fields: { name: "Grace Hopper", role: "Rear Admiral" },
	})

	expect(result).toMatchObject({ ok: true, outcome: "saved" })
	expect(await harness.drafts.open()).toMatchObject({
		content: "Our story.\n",
		fields: {
			team: [
				{ name: "Ada", role: "Engineer" },
				{ name: "Grace Hopper", role: "Rear Admiral" },
			],
		},
		revision: 1,
	})
})

test("a save writes scalar and composite rows back in the shape they were written in", async () => {
	setup()

	await rowDrafts("tags", "1")?.save({
		baseFields: { Tag: "one" },
		expectedRevision: null,
		fields: { Tag: "uno" },
	})
	await rowDrafts("links", "1")?.save({
		baseFields: { Label: "Home", URL: "/" },
		expectedRevision: 1,
		fields: { Label: "Start", URL: "/" },
	})

	expect(await harness.drafts.open()).toMatchObject({
		fields: {
			links: [["Start", "/"], { Label: "Blog", URL: "/blog" }],
			tags: ["uno", "two"],
		},
	})
})

test("two sessions editing different rows is a revision conflict, not a merge", async () => {
	setup()
	await rowDrafts("team", "1")?.save({
		baseFields: { name: "Ada", role: "Engineer" },
		expectedRevision: null,
		fields: { name: "Ada Lovelace", role: "Engineer" },
	})

	const result = await rowDrafts("team", "2")?.save({
		baseFields: { name: "Grace", role: "Admiral" },
		expectedRevision: null,
		fields: { name: "Grace Hopper", role: "Admiral" },
	})

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	expect(await harness.drafts.open()).toMatchObject({
		fields: {
			team: [
				{ name: "Ada Lovelace", role: "Engineer" },
				{ name: "Grace", role: "Admiral" },
			],
		},
		revision: 1,
	})
})

/** Another session's Singleton editor, reordering or removing rows and saving it to GitHub. */
async function commitTeamElsewhere(team: FieldRecord[]) {
	const opened = await harness.drafts.open()
	if (!opened.ok) throw new Error("A Singleton always opens")
	const content = {
		fields: { ...opened.fields, team },
		markdown: opened.content,
	}
	const saved = await harness.drafts.save({
		...content,
		expectedRevision: null,
	})
	if (!saved.ok || !("draft" in saved)) throw new Error("The save kept a draft")
	await harness.drafts.commit({
		...content,
		expectedRevision: saved.draft.revision,
	})
}

test("a row another session moved and saved to GitHub is a revision conflict, not an edit to the row now there", async () => {
	setup()
	const row = rowDrafts("team", "2")
	const opened = await row?.open()
	await commitTeamElsewhere([
		{ name: "Grace", role: "Admiral" },
		{ name: "Ada", role: "Engineer" },
	])

	const result = await row?.save({
		baseFields: opened?.fields ?? null,
		expectedRevision: opened?.revision ?? null,
		fields: { name: "Grace Hopper", role: "Admiral" },
	})

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	expect(await harness.drafts.open()).toMatchObject({
		fields: {
			team: [
				{ name: "Grace", role: "Admiral" },
				{ name: "Ada", role: "Engineer" },
			],
		},
	})
})

test("a row another session removed is a revision conflict", async () => {
	setup()
	const row = rowDrafts("team", "2")
	const opened = await row?.open()
	await commitTeamElsewhere([{ name: "Ada", role: "Engineer" }])

	const result = await row?.save({
		baseFields: opened?.fields ?? null,
		expectedRevision: opened?.revision ?? null,
		fields: { name: "Grace Hopper", role: "Admiral" },
	})

	expect(result).toEqual({ code: "revision-conflict", ok: false })
})

test("saving to GitHub from a row commits the whole Singleton at its path and answers with the row", async () => {
	setup()
	const row = rowDrafts("team", "1")
	const content = {
		baseFields: { name: "Ada", role: "Engineer" },
		fields: { name: "Ada Lovelace", role: "Engineer" },
	}
	await row?.save({ ...content, expectedRevision: null })

	const result = await row?.commit({
		...content,
		baseFields: content.fields,
		expectedRevision: 1,
	})

	expect(result).toMatchObject({
		draftDeleted: true,
		fields: { name: "Ada Lovelace", role: "Engineer" },
		ok: true,
		outcome: "committed",
	})
	expect(await harness.drafts.open()).toMatchObject({
		content: "Our story.\n",
		dirty: false,
		fields: {
			tags: ["one", "two"],
			team: [
				{ name: "Ada Lovelace", role: "Engineer" },
				{ name: "Grace", role: "Admiral" },
			],
			title: "About",
		},
	})
	expect(harness.sourceStore.get(TEST_SINGLETON_PATH)?.content).toContain(
		"Our story.",
	)
})

test("saving to GitHub from a row that moved commits nothing", async () => {
	setup()
	const row = rowDrafts("team", "2")
	const opened = await row?.open()
	await commitTeamElsewhere([{ name: "Ada", role: "Engineer" }])

	const result = await row?.commit({
		baseFields: opened?.fields ?? null,
		expectedRevision: opened?.revision ?? null,
		fields: { name: "Grace Hopper", role: "Admiral" },
	})

	expect(result).toEqual({ code: "revision-conflict", ok: false })
})
