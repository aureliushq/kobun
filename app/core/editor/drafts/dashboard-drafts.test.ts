import { eq } from "drizzle-orm"
import invariant from "tiny-invariant"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { NormalizedConfig } from "@/config/types"
import {
	TEST_CONFIG,
	TEST_SUBCOLLECTION_CONFIG,
} from "@/core/project-context/test-harness"
import { project } from "@/db/schema/app-schema"
import { ConfigStatus } from "@/db/types"
import { DASHBOARD_DRAFT_LIMIT, loadDashboardDrafts } from "./dashboard-drafts"
import { getDraftEditorPath } from "./draft-paths"
import { createDraftsTestHarness, type DraftsTestHarness } from "./test-harness"

/**
 * The dashboard's Draft list (#142).
 *
 * What the query answers — how many rows, how many there are, and which ones
 * never make it that far — rather than how a card reads, which is
 * `app/routes/dashboard.test.tsx`'s.
 */

const USER_ID = "user-1"

let harness: DraftsTestHarness

beforeEach(() => {
	harness = createDraftsTestHarness()
})

afterEach(() => {
	harness.close()
})

/** A Draft edited at a knowable moment, so ordering is asserted not raced. */
function seedDraftAt(
	minute: number,
	values: Parameters<DraftsTestHarness["seedDraft"]>[0] = {},
) {
	return harness.seedDraft({
		updatedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
		...values,
	})
}

/** The Project as a row whose Config the cache would serve. */
async function withStoredConfig(
	configParsedBy = KOBUN_VERSION,
	config: NormalizedConfig = TEST_CONFIG,
) {
	await harness.db
		.update(project)
		.set({
			configData: JSON.stringify(config),
			configParsedBy,
			configPath: ".kobun.json",
			configStatus: ConfigStatus.PRESENT,
		})
		.where(eq(project.id, harness.projectId))
}

describe("loadDashboardDrafts", () => {
	it("shows no more than the limit, newest edited first", async () => {
		for (let minute = 0; minute < DASHBOARD_DRAFT_LIMIT + 3; minute++) {
			seedDraftAt(minute, { itemSlug: `post-${minute}` })
		}

		const { drafts } = await loadDashboardDrafts(harness.db, USER_ID)

		expect(drafts).toHaveLength(DASHBOARD_DRAFT_LIMIT)
		expect(drafts.map((draft) => draft.itemSlug)).toEqual([
			"post-7",
			"post-6",
			"post-5",
			"post-4",
			"post-3",
		])
	})

	it("counts every Draft it has, not only the ones it shows", async () => {
		for (let minute = 0; minute < DASHBOARD_DRAFT_LIMIT + 3; minute++) {
			seedDraftAt(minute)
		}

		const { drafts, showingAll, total } = await loadDashboardDrafts(
			harness.db,
			USER_ID,
		)

		expect(drafts).toHaveLength(DASHBOARD_DRAFT_LIMIT)
		expect(showingAll).toBe(false)
		expect(total).toBe(DASHBOARD_DRAFT_LIMIT + 3)
	})

	it("lifts the limit when the writer asks for all of them", async () => {
		for (let minute = 0; minute < DASHBOARD_DRAFT_LIMIT + 3; minute++) {
			seedDraftAt(minute)
		}

		const { drafts, showingAll, total } = await loadDashboardDrafts(
			harness.db,
			USER_ID,
			{ all: true },
		)

		expect(drafts).toHaveLength(DASHBOARD_DRAFT_LIMIT + 3)
		expect(showingAll).toBe(true)
		expect(total).toBe(drafts.length)
	})

	it("deletes Synced Drafts rather than listing or counting them", async () => {
		const synced = seedDraftAt(0, {
			committedAt: new Date(Date.UTC(2026, 0, 1)),
			committedRevision: 2,
			revision: 2,
		})
		seedDraftAt(1, { committedRevision: 1, revision: 2 })

		const { drafts, total } = await loadDashboardDrafts(harness.db, USER_ID)

		expect(total).toBe(1)
		expect(drafts.map((draft) => draft.id)).not.toContain(synced.id)
		expect(await harness.readDraft(synced.id)).toBeUndefined()
	})

	it("answers a writer with no Projects with nothing at all", async () => {
		seedDraftAt(0)

		expect(await loadDashboardDrafts(harness.db, "nobody")).toEqual({
			drafts: [],
			showingAll: true,
			total: 0,
		})
	})

	it("names the Collection by its label when the Config declares it", async () => {
		await withStoredConfig()
		seedDraftAt(0)

		const { drafts } = await loadDashboardDrafts(harness.db, USER_ID)

		expect(drafts[0]?.collectionLabel).toBe("Posts")
	})

	it("names the Collection by its slug when an older Kobun parsed the Config", async () => {
		await withStoredConfig("0.0.0")
		seedDraftAt(0)

		const { drafts } = await loadDashboardDrafts(harness.db, USER_ID)

		expect(drafts[0]?.collectionLabel).toBe("posts")
	})

	it("keeps a Draft whose Collection the Config no longer declares", async () => {
		await withStoredConfig()
		seedDraftAt(0, { collectionSlug: "retired" })

		const { drafts } = await loadDashboardDrafts(harness.db, USER_ID)

		expect(drafts).toHaveLength(1)
		expect(drafts[0]?.collectionLabel).toBe("retired")
	})

	// A Subcollection's Draft is edited under its Parent Item, and is named by
	// both, so two Parent Items' Drafts of one Subcollection tell apart (#182).
	it("links a Subcollection's Draft to its editor under the Parent Item", async () => {
		await withStoredConfig(KOBUN_VERSION, TEST_SUBCOLLECTION_CONFIG)
		seedDraftAt(0, {
			collectionSlug: "projects",
			metadata: JSON.stringify({ title: "Launch" }),
			parentItem: "acme",
			subcollectionKey: "updates",
		})

		const [draft] = (await loadDashboardDrafts(harness.db, USER_ID)).drafts

		expect(draft).toMatchObject({
			collectionLabel: "acme / Updates",
			heading: "Launch",
		})
		invariant(draft, "the Draft is listed")
		expect(getDraftEditorPath(draft, draft.project)).toBe(
			`/acme/blog/collections/projects/items/acme/updates/editor/new?draft=${draft.id}`,
		)
	})

	it("names a Subcollection's Draft by its key when the Config no longer declares it", async () => {
		await withStoredConfig(KOBUN_VERSION, TEST_SUBCOLLECTION_CONFIG)
		seedDraftAt(0, {
			collectionSlug: "projects",
			parentItem: "acme",
			subcollectionKey: "retired",
		})

		const { drafts } = await loadDashboardDrafts(harness.db, USER_ID)

		expect(drafts[0]?.collectionLabel).toBe("acme / retired")
	})
})
