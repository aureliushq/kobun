import { redirect } from "react-router"
import { PATHS } from "@/ui/lib/constants"
import type {
	ProjectContextOk,
	ProjectContextResult,
	ProjectSession,
} from "./types"

/**
 * The page half of the HTTP translation: a refusal becomes the page that can do
 * something about it. Someone who is not signed in is sent to sign in; everyone
 * else — no Project, no Config, a Config that does not validate — is sent to
 * setup, which is where a repository gets connected and its Config diagnosed.
 *
 * Pure in its input and total over the union, so the map is readable in one
 * screen and testable without a request. The core resolver stays free of HTTP
 * (ADR-0001), and the API translation is a sibling of this, not a flag on it.
 */
export function toPageContext<TSession extends ProjectSession>(
	result: ProjectContextResult<TSession>,
): ProjectContextOk<TSession> {
	if (result.ok) return result
	throw redirect(result.reason === "anonymous" ? PATHS.LOGIN : PATHS.SETUP)
}
