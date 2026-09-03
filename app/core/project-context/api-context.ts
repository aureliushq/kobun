import type {
	ProjectAccess,
	ProjectContextRefusal,
	RefusedProjectContext,
} from "./types"

/**
 * What each refusal is, to something that wanted a status rather than a page.
 * A repository the user holds no Project for is indistinguishable from one that
 * does not exist — the same 404 either way, so that a probe learns nothing from
 * the difference.
 */
const REFUSALS: Record<
	ProjectContextRefusal,
	{ body: string; status: number }
> = {
	anonymous: { body: "Unauthorized", status: 401 },
	"no-project": { body: "Not Found", status: 404 },
}

/**
 * The API half of the HTTP translation, and the sibling of `toPageContext`: a
 * consumer that asked for bytes gets a status it can act on rather than a
 * redirect to a page it cannot render.
 *
 * Generic over the success arm so the one translation serves a caller that
 * resolved a Config and a caller that skipped it — the refusals are the same
 * two either way, and only they are this function's business. A Config that
 * would not resolve is not among them (ADR-0007); the only API caller skips the
 * Config anyway.
 */
export function toApiContext<Ok extends ProjectAccess>(
	result: Ok | RefusedProjectContext,
): Ok {
	if (result.ok) return result
	const { body, status } = REFUSALS[result.reason]
	throw new Response(body, { status })
}
