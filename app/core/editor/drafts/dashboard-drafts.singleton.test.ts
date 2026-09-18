import { afterEach, expect, test } from "vitest"
import { loadDashboardDrafts } from "./dashboard-drafts"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_SINGLETON_PATH,
	TEST_SINGLETON_SLUG,
} from "./test-harness"

let harness: DraftsTestHarness

afterEach(() => {
	harness.close()
})

test("neither lists nor counts a Singleton's draft, which has no card yet", async () => {
	harness = createDraftsTestHarness()
	const collectionDraft = harness.seedDraft({ revision: 1 })
	harness.seedDraft({
		collectionSlug: null,
		revision: 1,
		singletonSlug: TEST_SINGLETON_SLUG,
		sourcePath: TEST_SINGLETON_PATH,
	})

	const bounded = await loadDashboardDrafts(harness.db, "user-1")
	const all = await loadDashboardDrafts(harness.db, "user-1", { all: true })

	expect(bounded.drafts.map((draft) => draft.id)).toEqual([collectionDraft.id])
	expect(bounded.total).toBe(1)
	expect(all.drafts.map((draft) => draft.id)).toEqual([collectionDraft.id])
})
