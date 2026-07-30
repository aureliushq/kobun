import { expect, test } from "vitest"
import { createFakeSourceStore } from "./test-harness"

test("lists the direct children of a directory", async () => {
	const store = createFakeSourceStore([
		{ content: "a", name: "a.md", path: "content/posts/a.md", sha: "sha-a" },
		{
			content: "b",
			name: "b.md",
			path: "content/posts/nested/b.md",
			sha: "sha-b",
		},
	])

	expect(await store.list("content/posts")).toEqual([
		{ content: "a", name: "a.md", path: "content/posts/a.md", sha: "sha-a" },
	])
	expect(await store.list("content/pages")).toEqual([])
})

test("bumps the sha on every write", async () => {
	const store = createFakeSourceStore()

	const created = await store.write({
		content: "one",
		message: "create",
		path: "content/posts/a.md",
	})
	expect(created).toMatchObject({ ok: true })
	if (!created.ok) return

	const updated = await store.write({
		content: "two",
		expectedSha: created.contentSha,
		message: "update",
		path: "content/posts/a.md",
	})
	expect(updated).toMatchObject({ ok: true })
	if (!updated.ok) return
	expect(updated.contentSha).not.toBe(created.contentSha)
	expect(store.get("content/posts/a.md")).toMatchObject({
		content: "two",
		sha: updated.contentSha,
	})
})

test("refuses to create a file that already exists", async () => {
	const store = createFakeSourceStore([
		{ content: "a", name: "a.md", path: "content/posts/a.md", sha: "sha-a" },
	])

	await expect(
		store.write({
			content: "b",
			message: "create",
			path: "content/posts/a.md",
		}),
	).rejects.toThrow("already exists")
})

test("reports a stale sha when the write's expected sha has moved on", async () => {
	const store = createFakeSourceStore([
		{ content: "a", name: "a.md", path: "content/posts/a.md", sha: "sha-a" },
	])

	expect(
		await store.write({
			content: "b",
			expectedSha: "sha-stale",
			message: "update",
			path: "content/posts/a.md",
		}),
	).toEqual({ ok: false, reason: "stale-sha" })
})

test("reports a stale sha for a path flagged stale", async () => {
	const store = createFakeSourceStore([
		{ content: "a", name: "a.md", path: "content/posts/a.md", sha: "sha-a" },
	])
	store.setStale("content/posts/a.md")

	expect(
		await store.write({
			content: "b",
			expectedSha: "sha-a",
			message: "update",
			path: "content/posts/a.md",
		}),
	).toEqual({ ok: false, reason: "stale-sha" })
})
