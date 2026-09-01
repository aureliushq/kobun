import { redirect } from "react-router"
import { PATHS } from "@/ui/lib/constants"
import type {
	ProjectContextOk,
	ProjectContextResult,
	ProjectSession,
	UnconfiguredProjectContext,
} from "./types"

/**
 * Where a Project's own pages live. The dashboard is the one page a Project has
 * whether or not its Config can be read, so it is where every other page sends
 * a reader whose Config it needed and did not get.
 */
function dashboardPath({ name, owner }: { name: string; owner: string }) {
	return `/${owner}/${name}`
}

/**
 * The page half of the HTTP translation, and the sibling this bug was about.
 * Someone who is not signed in is sent to sign in; someone with no Project for
 * this repository is sent to setup, which is where one gets connected. A
 * Config that could not be read refuses nobody: a repository with no Config is
 * not "you have no Project", and answering it with setup — the page the writer
 * had just submitted from — is what left a freshly connected repository
 * unreachable (ADR-0007).
 *
 * Pure in its input and total over the union, so the map is readable in one
 * screen and testable without a request. The core resolver stays free of HTTP
 * (ADR-0001), and the API translation is a sibling of this, not a flag on it.
 */
export function toProjectPage<TSession extends ProjectSession>(
	result: ProjectContextResult<TSession>,
): ProjectContextOk<TSession> | UnconfiguredProjectContext<TSession> {
	if (!result.ok)
		throw redirect(result.reason === "anonymous" ? PATHS.LOGIN : PATHS.SETUP)
	return result
}

/**
 * The same translation for a page that cannot render without a Config: every
 * redirect above, plus the one that sends a Config it did not get to the
 * dashboard that reports it.
 */
export function toPageContext<TSession extends ProjectSession>(
	result: ProjectContextResult<TSession>,
): ProjectContextOk<TSession> {
	const context = toProjectPage(result)
	if (!context.config) throw redirect(dashboardPath(context))
	return context
}
