import invariant from "tiny-invariant"
import { afterEach, expect, test } from "vitest"
import { parseDocument } from "@/core/content/document.server"
import { stringifyFrontmatter } from "@/lib/frontmatter"
import {
	createSingletonDraftsTestHarness,
	type SingletonDraftsTestHarness,
	TEST_SINGLETON_PATH,
	TEST_SINGLETON_WITH_FEATURES,
} from "./test-harness"
import type { DraftContent } from "./types"

/**
 * A Singleton's Features stamp by the rules a Collection's do (ADR-0005, as
 * amended by ADR-0008): the Singleton runs the same lifecycle, so these pin that
 * the rules carry over rather than restating each one.
 */

const FIELDS = { title: "About" }
const SOURCE_BODY = "Source body\n"
const DRAFT_BODY = "Draft body\n"

const CREATED = "2026-08-31T09:14:00.000Z"
const LATER = "2026-09-02T11:30:00.000Z"
const BACKDATED = "2024-01-05T18:45:00.000Z"

const STAMPED = {
	...FIELDS,
	createdAt: CREATED,
	publishedAt: CREATED,
	status: "published",
	updatedAt: CREATED,
}

let harness: SingletonDraftsTestHarness
let clock: Date

/** A Singleton with every Feature on, and a clock the test moves by hand. */
function setup() {
	clock = new Date(CREATED)
	harness = createSingletonDraftsTestHarness({
		now: () => clock,
		singleton: TEST_SINGLETON_WITH_FEATURES,
	})
	return harness
}

function tick(instant: string) {
	clock = new Date(instant)
}

function putSource(data: Record<string, unknown>, body = SOURCE_BODY) {
	return harness.sourceStore.put({
		content: stringifyFrontmatter(body, data),
		path: TEST_SINGLETON_PATH,
	})
}

function committedData() {
	return parseDocument(
		harness.sourceStore.get(TEST_SINGLETON_PATH)?.content ?? "",
		"md",
	).data
}

function content(overrides: Partial<DraftContent> = {}): DraftContent {
	return {
		expectedRevision: null,
		fields: FIELDS,
		markdown: DRAFT_BODY,
		...overrides,
	}
}

afterEach(() => {
	harness?.close()
})

test("opens a Singleton with no Source on a stamped Created and a Status of Draft", async () => {
	const { drafts } = setup()

	const opened = await drafts.open()

	expect(opened).toMatchObject({
		draftId: null,
		fields: {
			createdAt: CREATED,
			publishedAt: "",
			status: "draft",
			updatedAt: "",
		},
		ok: true,
	})
})

test("stamps createdAt into the draft it mints", async () => {
	const { drafts } = setup()

	const result = await drafts.save(content())

	invariant(result.ok && "draft" in result, "the save mints a draft")
	const draft = await harness.readDraft(result.draft.id)
	expect(JSON.parse(draft?.metadata ?? "null")).toEqual({
		...FIELDS,
		createdAt: CREATED,
	})
})

test("writes every managed field when it publishes a Singleton that does not exist yet", async () => {
	const { drafts } = setup()

	const result = await drafts.publish(content())

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(committedData()).toEqual(STAMPED)
})

test("backfills only the timestamps when it saves to GitHub over a source that predates the Feature", async () => {
	const { drafts } = setup()
	putSource(FIELDS)

	const result = await drafts.commit(content())

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	// `publishedAt` and `status` are Publish's alone (ADR-0008).
	expect(committedData()).toEqual({
		...FIELDS,
		createdAt: CREATED,
		updatedAt: CREATED,
	})
})

test("keeps the status a source carries when it saves to GitHub", async () => {
	const { drafts } = setup()
	putSource({ ...FIELDS, status: "draft" })

	await drafts.commit(content({ fields: { ...FIELDS, status: "draft" } }))

	expect(committedData()).toMatchObject({ status: "draft" })
})

test("backfills the timestamps and declares it published when it publishes over a source that predates the Feature", async () => {
	const { drafts } = setup()
	putSource(FIELDS)

	await drafts.publish(content())

	expect(committedData()).toEqual(STAMPED)
})

test("advances updatedAt on a later publish and keeps createdAt and publishedAt", async () => {
	const { drafts } = setup()
	putSource(STAMPED)
	tick(LATER)

	await drafts.publish(content({ fields: STAMPED }))

	expect(committedData()).toEqual({ ...STAMPED, updatedAt: LATER })
})

test("commits the writer's updatedAt when they set it themselves", async () => {
	const { drafts } = setup()
	putSource(STAMPED)
	tick(LATER)

	await drafts.publish(
		content({ fields: { ...STAMPED, updatedAt: BACKDATED } }),
	)

	expect(committedData()).toMatchObject({ updatedAt: BACKDATED })
})

test("commits nothing when the writer changed nothing", async () => {
	const { drafts, sourceStore } = setup()
	putSource(STAMPED)
	const before = sourceStore.get(TEST_SINGLETON_PATH)
	tick(LATER)

	const result = await drafts.publish(
		content({ fields: STAMPED, markdown: SOURCE_BODY }),
	)

	expect(result).toMatchObject({ ok: true, outcome: "matches-source" })
	expect(sourceStore.get(TEST_SINGLETON_PATH)).toEqual(before)
})
