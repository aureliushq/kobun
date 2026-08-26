import type { RouterContextProvider } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { deriveConfigStatus, fetchAndParseConfig } from "@/config/github.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import type { ConfigResolver, RepositoryAddress } from "./config-resolver"
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
 * The Config, fetched live. Deriving the status here rather than in the module
 * keeps GitHub on this side of the port: `deriveConfigStatus` sits beside the
 * fetch that produced the result, so the resolver — and its tests — never reach
 * an octokit client. The cache that will make most of these calls unnecessary
 * replaces this adapter, not its callers (ADR-0003).
 */
function createLiveConfigResolver(env: Env): ConfigResolver {
	return {
		resolve: async ({ installationId, name, owner }: RepositoryAddress) => {
			const result = await fetchAndParseConfig(env, installationId, owner, name)
			return { config: result.config, status: deriveConfigStatus(result) }
		},
	}
}

/**
 * The module, wired to a request: the database off the router context, the
 * session off the request's headers, the Config off GitHub. Every caller that
 * needs its own failure translation starts here — the API wrapper that owns
 * the 401/404 half of the map will be the second (#65).
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
		configResolver: createLiveConfigResolver(env),
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
