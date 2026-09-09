import { afterEach, beforeEach, expect, test } from "vitest"
import { project } from "@/db/schema/app-schema"
import { countDirtyDrafts } from "./dirty-drafts"
import { createDraftsTestHarness, type DraftsTestHarness } from "./test-harness"

/**
 * How many Drafts hold work the repository does not have (#137).
 *
 * The predicate itself is `isDraftDirty`'s, pinned in `draft-state.test.ts`;
 * what is under test here is that the SQL says the same thing and that it says
 * it about one Project only — a Disconnect names this number before it deletes
 * the rows it counts.
 */

const OTHER_PROJECT = "project-2"

let harness: DraftsTestHarness

beforeEach(async () => {
	harness = createDraftsTestHarness()
	await harness.db.insert(project).values({
		configPath: "kobun.config.ts",
		configStatus: "present",
		id: OTHER_PROJECT,
		installationId: "installation-1",
		repoHtmlUrl: "https://github.com/acme/notes",
		repoId: "2",
		repoName: "notes",
		repoOwnerLogin: "acme",
		status: "active",
		userId: "user-1",
	})
})

afterEach(() => {
	harness.close()
})

test("a Draft that has never been committed is Dirty", async () => {
	harness.seedDraft({ committedRevision: null, revision: 1 })

	expect(await countDirtyDrafts(harness.db, harness.projectId)).toBe(1)
})

test("a Draft typed into since its commit is Dirty", async () => {
	harness.seedDraft({ committedRevision: 2, revision: 3 })

	expect(await countDirtyDrafts(harness.db, harness.projectId)).toBe(1)
})

test("a Clean Draft is not counted", async () => {
	harness.seedDraft({ committedRevision: 2, revision: 2 })

	expect(await countDirtyDrafts(harness.db, harness.projectId)).toBe(0)
})

test("a Project holding no Drafts counts none", async () => {
	expect(await countDirtyDrafts(harness.db, harness.projectId)).toBe(0)
})

test("only this Project's Drafts are counted", async () => {
	harness.seedDraft({ committedRevision: null, revision: 1 })
	harness.seedDraft({
		committedRevision: null,
		projectId: OTHER_PROJECT,
		revision: 1,
		sourcePath: "content/posts/elsewhere.md",
	})

	expect(await countDirtyDrafts(harness.db, harness.projectId)).toBe(1)
	expect(await countDirtyDrafts(harness.db, OTHER_PROJECT)).toBe(1)
})
