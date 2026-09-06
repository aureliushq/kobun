import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { NO_CONFIG_ERROR } from "@/config/errors"
import { ConfigStatus, ProjectStatus } from "@/db/types"
import { CONFIG_PATHS } from "@/ui/lib/constants"
import { CONFIG_CACHE_TTL_MS } from "./config-cache"
import {
	createProjectContextTestHarness,
	type ProjectContextTestHarness,
	type SeedProjectValues,
	TEST_CONFIG,
	TEST_CONFIG_JSON,
	TEST_CONFIG_PATH,
	TEST_NAME,
	TEST_OWNER,
} from "./test-harness"

const NOW = new Date("2026-08-26T12:00:00.000Z")
const TARGET = { name: TEST_NAME, owner: TEST_OWNER }

let harness: ProjectContextTestHarness

function setup(values: SeedProjectValues = {}) {
	harness = createProjectContextTestHarness(values)
	return harness
}

/**
 * A Project the cache can serve: checked at `NOW`, holding the fixture Config
 * at the sha and ETag the fake source's first revision reports.
 */
function cached(values: SeedProjectValues = {}): SeedProjectValues {
	return {
		configCheckedAt: NOW,
		configData: JSON.stringify(TEST_CONFIG),
		configEtag: '"etag-1"',
		configPath: TEST_CONFIG_PATH,
		configSha: "sha-1",
		configStatus: ConfigStatus.PRESENT,
		...values,
	}
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(NOW)
})

afterEach(() => {
	harness?.close()
	vi.useRealTimers()
})

test("serves a Config checked a moment ago without asking the repository", async () => {
	const { configSource, projectContext } = setup(cached())

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
	expect(configSource.calls).toEqual([])
})

test("still serves from the row a moment before the window closes", async () => {
	const { configSource, projectContext } = setup(cached())
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS - 1)

	expect(await projectContext.resolve(TARGET)).toMatchObject({ ok: true })
	expect(configSource.calls).toEqual([])
})

test("revalidates once the window has closed", async () => {
	const { configSource, projectContext } = setup(cached())
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({ ok: true })
	expect(configSource.calls).toEqual([
		{ etag: '"etag-1"', path: TEST_CONFIG_PATH },
	])
})

test("revalidates a Project whose last check is in the future", async () => {
	// Three writers stamp `configCheckedAt`, on clocks that need not agree. A
	// window measured without a floor would hold such a row stale until wall
	// clock caught up with it.
	const { configSource, projectContext } = setup(
		cached({ configCheckedAt: new Date(NOW.getTime() + 60 * 60 * 1000) }),
	)

	expect(await projectContext.resolve(TARGET)).toMatchObject({ ok: true })
	expect(configSource.calls).toHaveLength(1)
})

test("revalidates a Project that has never been checked", async () => {
	const { configSource, projectContext } = setup()

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
	expect(configSource.calls).toEqual([{ etag: null, path: TEST_CONFIG_PATH }])
})

test("asks unconditionally when the row has a status but no stored Config", async () => {
	// What connecting a repository leaves behind: a fresh `configCheckedAt` and
	// a `PRESENT` status, with the parsed Config never written. Sending the
	// stored ETag here would risk a not-modified with nothing to serve.
	const { configSource, projectContext } = setup(
		cached({ configData: null, configEtag: '"etag-1"' }),
	)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
	expect(configSource.calls).toEqual([{ etag: null, path: TEST_CONFIG_PATH }])
})

test("asks unconditionally when the stored Config is the literal null", async () => {
	// `syncProjectConfig` stores `JSON.stringify(null)`, which parses to null
	// rather than throwing.
	const { configSource, projectContext } = setup(cached({ configData: "null" }))

	expect(await projectContext.resolve(TARGET)).toMatchObject({ ok: true })
	expect(configSource.calls).toEqual([{ etag: null, path: TEST_CONFIG_PATH }])
})

test.each([
	ConfigStatus.UNKNOWN,
	ConfigStatus.TOO_LARGE,
	"valid",
])("revalidates a Project whose stored status is %o", async (configStatus) => {
	const { configSource, projectContext } = setup(cached({ configStatus }))

	expect(await projectContext.resolve(TARGET)).toMatchObject({ ok: true })
	expect(configSource.calls).toHaveLength(1)
})

test("revalidates a Project whose stored path is not one a Config lives at", async () => {
	const { configSource, projectContext } = setup(
		cached({ configPath: "kobun.config.ts" }),
	)

	expect(await projectContext.resolve(TARGET)).toMatchObject({ ok: true })
	// Nothing at the legacy path, so the probe finds the Config where it is.
	expect(configSource.calls).toContainEqual({
		etag: null,
		path: TEST_CONFIG_PATH,
	})
})

test.each([
	ConfigStatus.MISSING,
	ConfigStatus.ERROR,
])("serves a %s Config from the row without asking the repository", async (configStatus) => {
	const { configSource, projectContext } = setup(
		cached({ configData: null, configStatus }),
	)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem:
			configStatus === ConfigStatus.MISSING
				? "config-missing"
				: "config-invalid",
		ok: true,
	})
	expect(configSource.calls).toEqual([])
})

test("keeps the cached parse when the repository reports the Config unchanged", async () => {
	// Nothing was read, so nothing is news — including the Config error, which
	// still describes the file this 304 is about.
	const { configSource, projectContext, readProject } = setup(
		cached({ configError: '[{"code":"partial"}]' }),
	)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
	expect(configSource.calls).toHaveLength(1)

	const row = readProject()
	expect(row.configCheckedAt).toEqual(
		new Date(NOW.getTime() + CONFIG_CACHE_TTL_MS),
	)
	expect(row.configData).toBe(JSON.stringify(TEST_CONFIG))
	expect(row.configError).toBe('[{"code":"partial"}]')
	expect(row.configSha).toBe("sha-1")
})

test("opens a new window when the Config comes back unchanged", async () => {
	// Without refreshing the check time, an unchanged Config would be
	// revalidated on every navigation from here on.
	const { configSource, projectContext } = setup(cached())

	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)
	await projectContext.resolve(TARGET)
	await projectContext.resolve(TARGET)

	expect(configSource.calls).toHaveLength(1)
})

test("re-parses and rewrites the row when the Config changed", async () => {
	const { configSource, projectContext, readProject } = setup(cached())
	configSource.put(
		TEST_CONFIG_PATH,
		JSON.stringify({ ...JSON.parse(TEST_CONFIG_JSON), basePath: "docs" }),
	)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: { basePath: "docs" },
		ok: true,
	})

	const row = readProject()
	expect(JSON.parse(row.configData ?? "null")).toMatchObject({
		basePath: "docs",
	})
	expect(row.configEtag).toBe('"etag-2"')
	expect(row.configSha).toBe("sha-2")
	expect(row.configStatus).toBe(ConfigStatus.PRESENT)
	expect(row.configCheckedAt).toEqual(
		new Date(NOW.getTime() + CONFIG_CACHE_TTL_MS),
	)
})

test("leaves the Project status and the update time alone", async () => {
	// The dashboard sync owns the first, and setup orders its recent Projects
	// by the second — a revalidation is news about the Config, not a change to
	// the Project. The Config error is news about the Config, so it is not on
	// this list (ADR-0003 amendment).
	const { configSource, projectContext, readProject } = setup(
		cached({
			configError: '[{"code":"stale"}]',
			status: ProjectStatus.DISCONNECTED,
		}),
	)
	const before = readProject()
	configSource.put(TEST_CONFIG_PATH, TEST_CONFIG_JSON)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	await projectContext.resolve(TARGET)

	const row = readProject()
	expect(row.status).toBe(ProjectStatus.DISCONNECTED)
	expect(row.updatedAt).toEqual(before.updatedAt)
	expect(row.configCheckedAt).not.toEqual(before.configCheckedAt)
})

test("clears a stale Config error once the Config validates again", async () => {
	const { configSource, projectContext, readProject } = setup(
		cached({ configError: '[{"code":"stale"}]' }),
	)
	configSource.put(TEST_CONFIG_PATH, TEST_CONFIG_JSON)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	await projectContext.resolve(TARGET)

	expect(readProject().configError).toBe("")
})

test("reports a Config that stopped validating, without looking elsewhere", async () => {
	const { configSource, projectContext, readProject } = setup(cached())
	configSource.put(TEST_CONFIG_PATH, "{ not a Config")
	configSource.put(".kobun.yml", TEST_CONFIG_JSON)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-invalid",
		ok: true,
	})
	// A Config that is there but broken is not a Config that has moved.
	expect(configSource.calls).toHaveLength(1)

	const row = readProject()
	expect(row.configData).toBeNull()
	expect(row.configStatus).toBe(ConfigStatus.ERROR)
	// The dashboard renders this column, so the diagnosis has to come from
	// whichever path last looked at the repository (ADR-0003 amendment).
	const errors = JSON.parse(row.configError ?? "[]")
	expect(errors).toHaveLength(1)
	expect(errors[0].code).toBe("parse_error")
	// A parse error is about a file, and the validator does not know which one.
	expect(errors[0].path).toBe(TEST_CONFIG_PATH)
})

test("replaces stale validation errors when the Config is deleted", async () => {
	const { configSource, projectContext, readProject } = setup(
		cached({
			configData: null,
			configError: '[{"code":"invalid_type","message":"stale","path":"x"}]',
			configStatus: ConfigStatus.ERROR,
		}),
	)
	configSource.remove(TEST_CONFIG_PATH)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		configProblem: "config-missing",
		ok: true,
	})

	const errors = JSON.parse(readProject().configError ?? "[]")
	expect(errors).toEqual([NO_CONFIG_ERROR])
})

test("picks up a Config that has been fixed once the window closes", async () => {
	const { configSource, projectContext } = setup(
		cached({ configData: null, configStatus: ConfigStatus.ERROR }),
	)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-invalid",
		ok: true,
	})

	configSource.put(TEST_CONFIG_PATH, TEST_CONFIG_JSON)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
})

test("caches a repository that has no Config, and finds one added later", async () => {
	const { configSource, projectContext, readProject } = setup()
	configSource.remove(TEST_CONFIG_PATH)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-missing",
		ok: true,
	})
	expect(configSource.calls).toHaveLength(CONFIG_PATHS.length)

	const row = readProject()
	expect(row.configData).toBeNull()
	expect(row.configEtag).toBeNull()
	// The path a Config was last found at is still the best guess for where a
	// restored one will be, so a disappearance does not reset it.
	expect(row.configPath).toBe(TEST_CONFIG_PATH)
	expect(row.configSha).toBeNull()
	expect(row.configStatus).toBe(ConfigStatus.MISSING)

	await projectContext.resolve(TARGET)
	expect(configSource.calls).toHaveLength(CONFIG_PATHS.length)

	configSource.put(TEST_CONFIG_PATH, TEST_CONFIG_JSON)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
})

test("finds a renamed Config and remembers where it moved to", async () => {
	const { configSource, projectContext, readProject } = setup(cached())
	configSource.remove(TEST_CONFIG_PATH)
	configSource.put(".kobun.yml", TEST_CONFIG_JSON)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
	expect(configSource.calls).toEqual([
		{ etag: '"etag-1"', path: TEST_CONFIG_PATH },
		{ etag: null, path: ".kobun.yml" },
	])

	const row = readProject()
	expect(row.configPath).toBe(".kobun.yml")
	expect(row.configSha).toBe("sha-2")
})

test("serves the cached Config when the repository is unreachable", async () => {
	// Persisting a rate-limit blip would tell this writer their Config is
	// broken for a whole window.
	const { configSource, projectContext, readProject } = setup(cached())
	const before = readProject()
	configSource.failNext(new Error("API rate limit exceeded"))
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
	expect(readProject()).toEqual(before)
})

test("refuses without remembering when an unreachable repository is all there is", async () => {
	const { configSource, projectContext, readProject } = setup()
	const before = readProject()
	configSource.failNext(new Error("API rate limit exceeded"))

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-unreadable",
		ok: true,
	})
	expect(readProject()).toEqual(before)
})

test("recovers a Config restored byte for byte after a sync marked it missing", async () => {
	// A dashboard sync marks a Project missing without clearing the ETag it was
	// last given. Sending that ETag back would answer 304 — and a 304 against a
	// row that holds no Config would pin the Project as missing for good.
	const { projectContext } = setup(
		cached({ configData: null, configStatus: ConfigStatus.MISSING }),
	)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: null,
		configProblem: "config-missing",
		ok: true,
	})

	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
})

test("keeps the Config error when a rotated ETag turns out to be the same file", async () => {
	// The row's ETag is stale but its sha is not, so nothing is re-parsed — and
	// what nothing was re-parsed from is what the stored errors still describe.
	const { configSource, projectContext, readProject } = setup(
		cached({ configError: '[{"code":"partial"}]', configEtag: '"rotated"' }),
	)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({
		config: TEST_CONFIG,
		ok: true,
	})
	expect(configSource.calls).toEqual([
		{ etag: '"rotated"', path: TEST_CONFIG_PATH },
	])

	const row = readProject()
	expect(row.configEtag).toBe('"etag-1"')
	expect(row.configError).toBe('[{"code":"partial"}]')
})

test("spends no read on a stored path no Config lives at", async () => {
	const { configSource, projectContext } = setup(
		cached({ configPath: "kobun.config.ts" }),
	)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET)).toMatchObject({ ok: true })
	expect(configSource.calls).toEqual([{ etag: null, path: TEST_CONFIG_PATH }])
})

test("survives two loaders revalidating the same Project at once", async () => {
	// A layout and the page inside it can cross the window together. Both write
	// the same thing, so last-write-wins leaves the row coherent either way —
	// and neither reaches the Project's own status or update time, so the race
	// cannot cost a dashboard sync running alongside them its answer.
	const { configSource, projectContext, readProject } = setup(
		cached({
			configError: '[{"code":"stale"}]',
			status: ProjectStatus.DISCONNECTED,
		}),
	)
	const before = readProject()
	configSource.put(TEST_CONFIG_PATH, TEST_CONFIG_JSON)
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	const [first, second] = await Promise.all([
		projectContext.resolve(TARGET),
		projectContext.resolve(TARGET),
	])

	expect(first).toMatchObject({ config: TEST_CONFIG, ok: true })
	expect(second).toEqual(first)

	const row = readProject()
	expect(row.configEtag).toBe('"etag-2"')
	expect(row.configSha).toBe("sha-2")
	expect(row.configStatus).toBe(ConfigStatus.PRESENT)
	expect(row.configError).toBe("")
	expect(row.status).toBe(ProjectStatus.DISCONNECTED)
	expect(row.updatedAt).toEqual(before.updatedAt)
})

test("spends no read when the caller skipped the Config", async () => {
	// The window has lapsed, so a caller that wanted a Config would revalidate.
	// A page of a dozen images would revalidate a dozen times, in front of every
	// one of them.
	const { configSource, projectContext } = setup(cached())
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	expect(await projectContext.resolve(TARGET, { config: false })).toMatchObject(
		{ ok: true },
	)
	expect(configSource.calls).toEqual([])
})

test("leaves the Project row alone when the caller skipped the Config", async () => {
	// Not even the check time: a request that asked the repository nothing has
	// learned nothing about when its Config was last seen.
	const { projectContext, readProject } = setup(cached())
	const before = readProject()
	vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS)

	await projectContext.resolve(TARGET, { config: false })

	expect(readProject()).toEqual(before)
})
