import type { RouterContextProvider } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import {
	getGithubFileContentConditional,
	hasStatus,
} from "@/github/octokit.server"
import { toApiContext } from "./api-context"
import type {
	ConfigSource,
	ConfigSourceRead,
	ConfigSourceRequest,
	RepositoryAddress,
} from "./config-source"
import { createProjectContext } from "./create-project-context"
import { toPageContext, toProjectPage } from "./page-context"
import type { ApiAccessContext, PageContext, ProjectPageContext } from "./types"

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

/** Named so the type below can be read off it rather than spelled out. */
function readSession(env: Env, request: Request) {
	return getAuth(env).api.getSession({ headers: request.headers })
}

/**
 * The session as this application's authentication provider hands it over. The
 * module only ever reads an id off it, but it gives back what it was given, so
 * a loader that also wants a display name has it without asking twice.
 */
type AuthSession = NonNullable<Awaited<ReturnType<typeof readSession>>>

/**
 * The module, wired to a request: the database off the router context, the
 * session off the request's headers, the Config off the Project row or, once
 * its window has closed, off GitHub. Every wrapper below starts here and asks
 * its own question of what comes back — the module itself, rather than an
 * answer already given, so that each keeps the type its question earns.
 */
function wireProjectContext(args: ProjectContextArgs) {
	const { context, params, request } = args
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const projectContext = createProjectContext({
		configSource: createGithubConfigSource(env),
		db,
		getSession: () => readSession(env, request),
	})

	return {
		db,
		env,
		projectContext,
		target: { name: params.name, owner: params.owner },
	}
}

/**
 * The Project Context a page can rely on, or the redirect that explains why it
 * cannot have one. Routes get `db` and `env` back alongside it, since that is
 * what they were reaching into the router context for in the first place.
 */
export async function requirePageContext(
	args: ProjectContextArgs,
): Promise<PageContext<AuthSession>> {
	const { db, env, projectContext, target } = wireProjectContext(args)
	const result = await projectContext.resolve(target)
	return { ...toPageContext(result), db, env }
}

/**
 * What the Project's own pages rely on: the same context, except that a Config
 * that would not resolve comes back to be rendered rather than redirected away
 * from. Only the dashboard uses this — it is the one page a Project has before
 * it has a readable Config, and sending it to setup is what left a freshly
 * connected repository unreachable (ADR-0007).
 */
export async function requireProjectPage(
	args: ProjectContextArgs,
): Promise<ProjectPageContext<AuthSession>> {
	const { db, env, projectContext, target } = wireProjectContext(args)
	const result = await projectContext.resolve(target)
	return { ...toProjectPage(result), db, env }
}

/**
 * The same access an API route can rely on, or the status that explains why it
 * cannot have it — resolved without the Config, which is the whole reason this
 * wrapper is not `requirePageContext` with a different translation. An asset
 * request answers a picture: it must never wait on a Config revalidation, and
 * it never reads a Config it did not wait for.
 */
export async function requireApiAccess(
	args: ProjectContextArgs,
): Promise<ApiAccessContext<AuthSession>> {
	const { db, env, projectContext, target } = wireProjectContext(args)
	const result = await projectContext.resolve(target, { config: false })
	return { ...toApiContext(result), db, env }
}
