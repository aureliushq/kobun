import { afterEach, expect, test } from "vitest"
import {
	createFakeConfigSource,
	createProjectContextTestHarness,
	type ProjectContextTestHarness,
	TEST_CONFIG,
	TEST_CONFIG_JSON,
	TEST_CONFIG_PATH,
	TEST_INSTALLATION_ID,
	TEST_NAME,
	TEST_OWNER,
} from "./test-harness"

const REPOSITORY = {
	installationId: TEST_INSTALLATION_ID,
	name: TEST_NAME,
	owner: TEST_OWNER,
}

let harness: ProjectContextTestHarness

afterEach(() => {
	harness?.close()
})

test("seeds a Project the resolver finds", async () => {
	harness = createProjectContextTestHarness()

	expect(
		await harness.projectContext.resolve({
			name: TEST_NAME,
			owner: TEST_OWNER,
		}),
	).toMatchObject({ ok: true })
})

test("seeds another user's Project under enforced foreign keys", () => {
	harness = createProjectContextTestHarness()
	harness.seedUser("user-2")

	expect(() =>
		harness.seedProject({ repoName: "secrets", userId: "user-2" }),
	).not.toThrow()
})

test("refuses to seed a Project for a user who does not exist", () => {
	harness = createProjectContextTestHarness()

	expect(() => harness.seedProject({ userId: "nobody" })).toThrow()
})

test("declares a Config the real validator accepts", () => {
	expect(TEST_CONFIG.basePath).toBe("content")
	expect(Object.keys(TEST_CONFIG.collections)).toEqual(["posts"])
	expect(Object.keys(TEST_CONFIG.singletons)).toEqual(["about"])
	expect(TEST_CONFIG.errors).toEqual([])
})

test("serves a file the repository holds, with a sha and an ETag", async () => {
	const configSource = createFakeConfigSource()

	expect(
		await configSource.read(REPOSITORY, { path: TEST_CONFIG_PATH }),
	).toEqual({
		content: TEST_CONFIG_JSON,
		etag: '"etag-1"',
		kind: "content",
		sha: "sha-1",
	})
})

test("reports a file the repository does not hold", async () => {
	const configSource = createFakeConfigSource()

	expect(await configSource.read(REPOSITORY, { path: ".kobun.yml" })).toEqual({
		kind: "not-found",
	})
})

test("reports a matching ETag as unchanged, and a stale one as content", async () => {
	const configSource = createFakeConfigSource()

	expect(
		await configSource.read(REPOSITORY, {
			etag: '"etag-1"',
			path: TEST_CONFIG_PATH,
		}),
	).toEqual({ kind: "not-modified" })

	configSource.put(TEST_CONFIG_PATH, "{}")

	expect(
		await configSource.read(REPOSITORY, {
			etag: '"etag-1"',
			path: TEST_CONFIG_PATH,
		}),
	).toMatchObject({ content: "{}", etag: '"etag-2"', kind: "content" })
})

test("stops holding a file that was removed", async () => {
	const configSource = createFakeConfigSource()
	configSource.remove(TEST_CONFIG_PATH)

	expect(
		await configSource.read(REPOSITORY, { path: TEST_CONFIG_PATH }),
	).toEqual({ kind: "not-found" })
})

test("fails one read on demand, then answers again", async () => {
	const configSource = createFakeConfigSource()
	const outage = new Error("API rate limit exceeded")
	configSource.failNext(outage)

	await expect(
		configSource.read(REPOSITORY, { path: TEST_CONFIG_PATH }),
	).rejects.toBe(outage)
	await expect(
		configSource.read(REPOSITORY, { path: TEST_CONFIG_PATH }),
	).resolves.toMatchObject({ kind: "content" })
})

test("records every read the module made, in order", async () => {
	const configSource = createFakeConfigSource()

	await configSource.read(REPOSITORY, { etag: null, path: TEST_CONFIG_PATH })
	await configSource.read(REPOSITORY, { etag: '"etag-1"', path: ".kobun.yml" })

	expect(configSource.calls).toEqual([
		{ etag: null, path: TEST_CONFIG_PATH },
		{ etag: '"etag-1"', path: ".kobun.yml" },
	])
})
