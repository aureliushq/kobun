import { and, eq } from "drizzle-orm"
import { project } from "@/db/schema/app-schema"
import { ConfigStatus } from "@/db/types"
import type { ConfigResolution, ConfigResolver } from "./config-resolver"
import type {
	ProjectContextDatabase,
	ProjectContextRefusal,
	ProjectContextResult,
	SessionGetter,
} from "./types"

function refuse(reason: ProjectContextRefusal): ProjectContextResult {
	return { ok: false, reason }
}

/**
 * Why a Config that did not arrive is unusable. A status of `PRESENT` with no
 * parsed Config is a resolver that contradicted itself; treating it as invalid
 * keeps a browsable Project from ever being built over a Config that isn't
 * there.
 */
function refuseConfig(resolution: ConfigResolution): ProjectContextResult {
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
 */
export function createProjectContext(deps: {
	configResolver: ConfigResolver
	db: ProjectContextDatabase
	getSession: SessionGetter
}) {
	const { configResolver, db, getSession } = deps

	async function resolve(target: {
		name: string
		owner: string
	}): Promise<ProjectContextResult> {
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
		const resolution = await configResolver.resolve({
			installationId,
			name,
			owner,
		})
		if (!resolution.config) return refuseConfig(resolution)

		return {
			config: resolution.config,
			installationId,
			name,
			ok: true,
			owner,
			projectRow,
			session,
		}
	}

	return { resolve }
}
