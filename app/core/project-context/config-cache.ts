import { eq } from "drizzle-orm"
import type { NormalizedConfig } from "@/config/types"
import { configFileFormat, validateConfig } from "@/config/validator"
import { project } from "@/db/schema/app-schema"
import { ConfigStatus, type ProjectWithGithubInstallation } from "@/db/types"
import { CONFIG_PATHS } from "@/ui/lib/constants"
import type {
	ConfigSource,
	ConfigSourceRead,
	ConfigSourceRequest,
	RepositoryAddress,
} from "./config-source"
import type { ProjectContextDatabase } from "./types"

/**
 * How long a Config is trusted without asking the repository again. There is no
 * webhook, so revalidation is the only invalidation signal and this is the
 * staleness bound, not an optimization knob (ADR-0003).
 */
export const CONFIG_CACHE_TTL_MS = 60_000

/** A Config, already classified — the answer the resolver refuses or accepts on. */
export interface ConfigResolution {
	config: NormalizedConfig | null
	status: ConfigStatus
}

/** The columns the cache owns. Everything else on the row belongs to somebody else. */
interface ConfigColumns {
	configData: string | null
	configEtag: string | null
	configPath: string
	configSha: string | null
	configStatus: ConfigStatus
}

/**
 * The stored Config, if the row actually holds one. `syncProjectConfig` writes
 * `JSON.stringify(null)` when parsing failed, and `JSON.parse("null")` yields
 * null rather than throwing — so a try/catch alone would hand back nothing and
 * call it a Config.
 */
function storedConfig(configData: string | null): NormalizedConfig | null {
	if (!configData) return null

	let parsed: unknown
	try {
		parsed = JSON.parse(configData)
	} catch {
		return null
	}

	if (typeof parsed !== "object" || parsed === null) return null
	if (!("collections" in parsed)) return null
	return parsed as NormalizedConfig
}

/**
 * What the row can be served as, or null when it cannot be served at all.
 *
 * Unservable is not the same as stale: connecting a repository stamps a fresh
 * check time with a `PRESENT` status and no parsed Config (`setup.tsx`), and a
 * status this module never wrote says nothing about what is in the repository.
 * Either way there is nothing to fall back on, which is also why such a row may
 * never be revalidated conditionally.
 */
function isConfigPath(path: string) {
	return CONFIG_PATHS.includes(path)
}

function servable(row: ProjectWithGithubInstallation): ConfigResolution | null {
	if (!isConfigPath(row.configPath)) return null

	if (row.configStatus === ConfigStatus.MISSING)
		return { config: null, status: ConfigStatus.MISSING }
	if (row.configStatus === ConfigStatus.ERROR)
		return { config: null, status: ConfigStatus.ERROR }
	if (row.configStatus !== ConfigStatus.PRESENT) return null

	const config = storedConfig(row.configData)
	return config ? { config, status: ConfigStatus.PRESENT } : null
}

/** A Config file's bytes, classified. The Format follows the path, as it always has. */
function parseConfig(path: string, content: string): ConfigResolution {
	const { config } = validateConfig(content, configFileFormat(path))
	return {
		config,
		status: config ? ConfigStatus.PRESENT : ConfigStatus.ERROR,
	}
}

/**
 * The Config cache: the whole of ADR-0003's policy, in one place. Serve the
 * parsed copy on the Project row while it is recent; past that, spend one
 * conditional read on the path it was last found at and write back what came
 * of it. Missing and invalid Configs cache exactly like present ones, so a
 * repository with no Config is not slower than a healthy one.
 *
 * The port beneath it reads one file by path. Everything else — when to ask,
 * what a 404 means, which paths to try next, what to remember — is here.
 */
export function createConfigCache(deps: {
	configSource: ConfigSource
	db: ProjectContextDatabase
}) {
	const { configSource, db } = deps

	/**
	 * One read, or null when the repository could not be reached at all. Null is
	 * not an answer about the Config: a rate-limited or unreachable GitHub says
	 * nothing about what is in the repository, and nothing it says is written
	 * down. Only the port is guarded — a failed write is a real failure, and
	 * still propagates.
	 */
	async function read(
		repository: RepositoryAddress,
		request: ConfigSourceRequest,
	): Promise<ConfigSourceRead | null> {
		try {
			return await configSource.read(repository, request)
		} catch {
			return null
		}
	}

	/**
	 * What to answer when the repository could not be reached. Serving the last
	 * Config we had is the whole point of holding one; with nothing held there
	 * is nothing to say, and the next request — not the next window — retries,
	 * because the blip was never written down.
	 */
	function unreachable(cached: ConfigResolution | null): ConfigResolution {
		return cached ?? { config: null, status: ConfigStatus.UNKNOWN }
	}

	/**
	 * A revalidation is news about the Config, not a change to the Project. It
	 * leaves `configError` and `status` to the dashboard sync that owns them,
	 * and carries `updatedAt` through by hand — the column has an `$onUpdate`,
	 * and setup's recent-Projects list is ordered by it.
	 */
	async function recordCheck(
		row: ProjectWithGithubInstallation,
		now: number,
		columns?: ConfigColumns,
	) {
		await db
			.update(project)
			.set({
				...columns,
				configCheckedAt: new Date(now),
				updatedAt: row.updatedAt,
			})
			.where(eq(project.id, row.id))
	}

	async function rememberConfig(
		row: ProjectWithGithubInstallation,
		now: number,
		path: string,
		read: Extract<ConfigSourceRead, { kind: "content" }>,
	): Promise<ConfigResolution> {
		const resolution = parseConfig(path, read.content)
		await recordCheck(row, now, {
			configData: resolution.config ? JSON.stringify(resolution.config) : null,
			configEtag: read.etag,
			configPath: path,
			configSha: read.sha,
			configStatus: resolution.status,
		})
		return resolution
	}

	/**
	 * Where else a Config could be. Reached when the stored path 404s, which is
	 * what renaming `.kobun.json` to `.kobun.yml` looks like from here. Reads are
	 * unconditional: an ETag means nothing at a path it did not come from.
	 */
	async function probe(
		row: ProjectWithGithubInstallation,
		repository: RepositoryAddress,
		cached: ConfigResolution | null,
		now: number,
	): Promise<ConfigResolution> {
		for (const path of CONFIG_PATHS) {
			// The stored path was just read, and was not there.
			if (path === row.configPath) continue

			const found = await read(repository, { etag: null, path })
			if (!found) return unreachable(cached)
			if (found.kind !== "content") continue
			return await rememberConfig(row, now, path, found)
		}

		await recordCheck(row, now, {
			configData: null,
			configEtag: null,
			// A Config that disappears keeps the path it was last found at: that
			// is still the best guess for where a restored one will be.
			configPath: row.configPath,
			configSha: null,
			configStatus: ConfigStatus.MISSING,
		})
		return { config: null, status: ConfigStatus.MISSING }
	}

	async function revalidate(
		row: ProjectWithGithubInstallation,
		repository: RepositoryAddress,
		cached: ConfigResolution | null,
		now: number,
	): Promise<ConfigResolution> {
		// Nowhere a Config lives, so there is nothing to revalidate against.
		if (!isConfigPath(row.configPath))
			return await probe(row, repository, cached, now)

		// What the row remembers of a file at that path. A Project whose Config
		// is missing remembers no file, so its ETag and its sha describe nothing
		// — and not every writer clears them: a dashboard sync leaves both
		// behind when it marks a Project missing. Trusting them would answer a
		// restored Config with "still missing", past every window, for good.
		const remembered =
			cached && cached.status !== ConfigStatus.MISSING ? cached : null

		const found = await read(repository, {
			etag: remembered ? row.configEtag : null,
			path: row.configPath,
		})
		if (!found) return unreachable(cached)

		if (found.kind === "not-modified") {
			// Nothing changed, so nothing is rewritten — but the window reopens,
			// or an unchanged Config would be revalidated on every navigation.
			await recordCheck(row, now)
			return cached ?? { config: null, status: ConfigStatus.UNKNOWN }
		}

		if (found.kind === "not-found")
			return await probe(row, repository, cached, now)

		// A rotated ETag over bytes that never changed. Shas are content
		// addressed, so there is nothing to re-parse.
		if (remembered && found.sha === row.configSha) {
			await recordCheck(row, now, {
				configData: row.configData,
				configEtag: found.etag,
				configPath: row.configPath,
				configSha: row.configSha,
				configStatus: remembered.status,
			})
			return remembered
		}

		return await rememberConfig(row, now, row.configPath, found)
	}

	async function resolve(
		row: ProjectWithGithubInstallation,
		repository: RepositoryAddress,
	): Promise<ConfigResolution> {
		const now = Date.now()
		const cached = servable(row)
		const age =
			row.configCheckedAt === null ? null : now - row.configCheckedAt.getTime()

		// A check time in the future is a clock disagreeing with ours, not a
		// recent check; without the floor such a row would never revalidate.
		if (cached && age !== null && age >= 0 && age < CONFIG_CACHE_TTL_MS)
			return cached

		return await revalidate(row, repository, cached, now)
	}

	return { resolve }
}
