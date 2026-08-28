import { afterEach, expect, test, vi } from "vitest"
import { fetchReleaseInfo } from "./release-info.server"

const APP_URL = "https://kobun.test"
const RUNNING = "0.3.3"

const MANIFEST = {
	changelogUrl: "https://kobun.test/changelog",
	releaseUrl: "https://github.com/aureliushq/kobun/releases/tag/v9.9.9",
	version: "9.9.9",
}

function answerWith(body: string, status = 200) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(body, { status })),
	)
}

afterEach(() => {
	vi.unstubAllGlobals()
})

test("reports an update when the manifest names a version other than the running one", async () => {
	answerWith(JSON.stringify(MANIFEST))

	expect(await fetchReleaseInfo(APP_URL, RUNNING)).toEqual({
		changelogUrl: MANIFEST.changelogUrl,
		hasUpdate: true,
		latestVersion: "9.9.9",
		releaseUrl: MANIFEST.releaseUrl,
	})
})

test("reports no update when the manifest names the running version", async () => {
	answerWith(JSON.stringify({ ...MANIFEST, version: RUNNING }))

	const release = await fetchReleaseInfo(APP_URL, RUNNING)

	expect(release.hasUpdate).toBe(false)
	expect(release.latestVersion).toBe(RUNNING)
})

test("falls back to the running version when the manifest answers an error", async () => {
	answerWith("Not Found", 404)

	expect(await fetchReleaseInfo(APP_URL, RUNNING)).toEqual({
		changelogUrl: "",
		hasUpdate: false,
		latestVersion: RUNNING,
		releaseUrl: "",
	})
})

test("falls back to the running version when the request never lands", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			throw new Error("network is unreachable")
		}),
	)

	expect(await fetchReleaseInfo(APP_URL, RUNNING)).toEqual({
		changelogUrl: "",
		hasUpdate: false,
		latestVersion: RUNNING,
		releaseUrl: "",
	})
})

test("falls back to the running version when the manifest is not JSON", async () => {
	answerWith("<!doctype html><title>login</title>")

	expect(await fetchReleaseInfo(APP_URL, RUNNING)).toEqual({
		changelogUrl: "",
		hasUpdate: false,
		latestVersion: RUNNING,
		releaseUrl: "",
	})
})

test("does not reach for a manifest a self-hosted instance cannot name", async () => {
	const fetchSpy = vi.fn()
	vi.stubGlobal("fetch", fetchSpy)

	const release = await fetchReleaseInfo(undefined, RUNNING)

	expect(fetchSpy).not.toHaveBeenCalled()
	expect(release.latestVersion).toBe(RUNNING)
})
