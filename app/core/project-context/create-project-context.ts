import { and, eq } from "drizzle-orm"
import { project } from "@/db/schema/app-schema"
import { ConfigStatus } from "@/db/types"
import { type ConfigResolution, createConfigCache } from "./config-cache"
import type { ConfigSource } from "./config-source"
import type {
	ProjectAccessResult,
	ProjectContextDatabase,
	ProjectContextRefusal,
	ProjectContextResult,
	ProjectTarget,
	RefusedProjectContext,
	SessionGetter,
	SkipConfig,
} from "./types"

function refuse(reason: ProjectContextRefusal): RefusedProjectContext {
	return { ok: false, reason }
}

/**
 * Why a Config that did not arrive is unusable. A status of `PRESENT` with no
 * parsed Config is a resolver that contradicted itself; treating it as invalid
 * keeps a browsable Project from ever being built over a Config that isn't
 * there.
 */
function refuseConfig(resolution: ConfigResolution): RefusedProjectContext {
	return refuse(
		resolution.status === ConfigStatus.MISSING
			? "config-missing"
			: "config-invalid",
	)
}

/**
 * Who the user is, which Project they are looking at, and what its Config says
 * — answered once, for every content route.
 *
 * Every refusal is reported rather than thrown (ADR-0001): an anonymous visitor
 * and a mistyped repository are normal traffic, and a page redirects where an
 * API returns a status. Both translations live in wrappers above this.
 *
 * Ownership is a single scoped query. Expressing it in the `WHERE` clause rather
 * than by filtering a user's Projects in JavaScript is the point of the seam:
 * there is one place a future page can weaken it, and it is here.
 *
 * A caller with no use for a Config passes `{ config: false }` and is answered
 * without one, in both senses: nothing is fetched, and nothing about a Config
 * comes back.
 */
export function createProjectContext(deps: {
	configSource: ConfigSource
	db: ProjectContextDatabase
	getSession: SessionGetter
}) {
	const { configSource, db, getSession } = deps
	const configCache = createConfigCache({ configSource, db })

	async function resolve(target: ProjectTarget): Promise<ProjectContextResult>
	async function resolve(
		target: ProjectTarget,
		options: SkipConfig,
	): Promise<ProjectAccessResult>
	async function resolve(
		target: ProjectTarget,
		options?: SkipConfig,
	): Promise<ProjectAccessResult | ProjectContextResult> {
		const { name, owner } = target

		const session = await getSession()
		if (!session?.user) return refuse("anonymous")

		const projectRow = await db.query.project.findFirst({
			where: and(
				eq(project.userId, session.user.id),
				eq(project.repoOwnerLogin, owner),
				eq(project.repoName, name),
			),
			with: { githubInstallation: true },
		})
		if (!projectRow) return refuse("no-project")

		const installationId = projectRow.githubInstallation.githubInstallationId
		const access = {
			installationId,
			name,
			ok: true as const,
			owner,
			projectRow,
			session,
		}
		// Not a shortcut past a check: everything that decides whether this user
		// may read this repository has already been answered above. What is left
		// is what the repository declares, and an asset request is not asking.
		if (options?.config === false) return access

		const resolution = await configCache.resolve(projectRow, {
			installationId,
			name,
			owner,
		})
		if (!resolution.config) return refuseConfig(resolution)

		return { ...access, config: resolution.config }
	}

	return { resolve }
}
