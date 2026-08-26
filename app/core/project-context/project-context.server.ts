import type { RouterContextProvider } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import {
	getGithubFileContentConditional,
	hasStatus,
} from "@/github/octokit.server"
import type {
	ConfigSource,
	ConfigSourceRead,
	ConfigSourceRequest,
	RepositoryAddress,
} from "./config-source"
import { createProjectContext } from "./create-project-context"
import { toPageContext } from "./page-context"
import type {
	PageContext,
	ProjectContextDatabase,
	ProjectContextResult,
} from "./types"

/**
 * What every route already receives. Typed structurally rather than off a
 * generated `Route` namespace so one wrapper serves loaders, actions, and the
 * plain-args API routes alike.
 */
export interface ProjectContextArgs {
	context: Readonly<RouterContextProvider>
	params: { name: string; owner: string }
	request: Request
}

/**
 * The repository, as a place a Config file can be read from. Octokit reports a
 * file that is absent and a file that has not changed by throwing; both are
 * ordinary answers to this port, and translating them is this adapter's whole
 * job — the same division the drafts module's SourceStore draws (ADR-0001), so
 * neither the cache nor its tests ever meets a GitHub client.
 *
 * GitHub identity travels in the address rather than this closure: which
 * installation to read through is a fact of the Project, and no Project is
 * known until the resolver has found one.
 */
function createGithubConfigSource(env: Env): ConfigSource {
	return {
		read: async (
			{ installationId, name, owner }: RepositoryAddress,
			{ etag, path }: ConfigSourceRequest,
		): Promise<ConfigSourceRead> => {
			try {
				const file = await getGithubFileContentConditional(
					env,
					installationId,
					owner,
					name,
					path,
					etag,
				)
				return {
					content: file.content,
					etag: file.etag,
					kind: "content",
					sha: file.sha,
				}
			} catch (error) {
				// An unchanged Config costs a 304, which GitHub does not charge
				// against the installation's rate limit.
				if (hasStatus(error, 304)) return { kind: "not-modified" }
				if (hasStatus(error, 404)) return { kind: "not-found" }
				throw error
			}
		},
	}
}

/**
 * The module, wired to a request: the database off the router context, the
 * session off the request's headers, the Config off the Project row or, once
 * its window has closed, off GitHub. Every caller that needs its own failure
 * translation starts here — the API wrapper that owns the 401/404 half of the
 * map will be the second (#65).
 */
async function resolveProjectContextFromRequest(
	args: ProjectContextArgs,
): Promise<{
	db: ProjectContextDatabase
	env: Env
	result: ProjectContextResult
}> {
	const { context, params, request } = args
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const projectContext = createProjectContext({
		configSource: createGithubConfigSource(env),
		db,
		getSession: () => getAuth(env).api.getSession({ headers: request.headers }),
	})

	const result = await projectContext.resolve({
		name: params.name,
		owner: params.owner,
	})
	return { db, env, result }
}

/**
 * The Project Context a page can rely on, or the redirect that explains why it
 * cannot have one. Routes get `db` and `env` back alongside it, since that is
 * what they were reaching into the router context for in the first place.
 */
export async function requirePageContext(
	args: ProjectContextArgs,
): Promise<PageContext> {
	const { db, env, result } = await resolveProjectContextFromRequest(args)
	return { ...toPageContext(result), db, env }
}
