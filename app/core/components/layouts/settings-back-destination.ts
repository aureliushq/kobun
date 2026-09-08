import { PATHS } from "@/ui/lib/constants"

export interface BackDestination {
	label: string
	to: string
}

/**
 * Where the back link on `/settings` points.
 *
 * The account page is the one authenticated surface with no Project in its URL
 * (ADR-0010), so the way back cannot be read off params the way every other
 * page reads it. Three answers, in order: the Project the writer came from, the
 * one the caller ordered first, or setup — which is where `routes/index.tsx`
 * sends a signed-in writer anyway, and the only honest destination for someone
 * who has no Project to go back to.
 *
 * `from` is a URL the writer controls, so it is honoured only where it matches
 * the dashboard path of a Project the caller has already established they have.
 * Anything else — another account's Project, an absolute URL wearing a
 * Project's path, the same path spelt differently — is not a place this link
 * may send them.
 */
export function chooseBackDestination({
	from,
	projects,
}: {
	from: string | null
	/**
	 * The writer's own Projects, most recently updated first. Only the two
	 * parts of a dashboard path are needed, so that is all this asks for.
	 */
	projects: { repoName: string; repoOwnerLogin: string }[]
}): BackDestination {
	const destinations = projects.map((project) => ({
		label: `${project.repoOwnerLogin}/${project.repoName}`,
		to: `/${project.repoOwnerLogin}/${project.repoName}`,
	}))

	const requested = destinations.find((destination) => destination.to === from)
	if (requested) return requested

	return destinations[0] ?? { label: "Set up a Project", to: PATHS.SETUP }
}
