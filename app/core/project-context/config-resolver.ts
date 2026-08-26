import type { NormalizedConfig } from "@/config/types"
import type { ConfigStatus } from "@/db/types"
import type { InstallationID } from "@/types/github"

/**
 * Where a Config is read from. GitHub coordinates, deliberately: "repo" is
 * GitHub-side vocabulary, and a Project is the thing a user connects to one.
 */
export interface RepositoryAddress {
	installationId: InstallationID
	name: string
	owner: string
}

/**
 * A Config, already classified. The port speaks status rather than handing back
 * a fetch result for the module to interpret: deriving the status lives with the
 * code that knows how the Config was fetched, which keeps GitHub — and the whole
 * octokit client behind it — out of the resolver and out of its tests.
 */
export interface ConfigResolution {
	config: NormalizedConfig | null
	status: ConfigStatus
}

/**
 * Where a Project's Config comes from, as the module sees it. Today every
 * adapter fetches it live; the cache policy that will serve it from the Project
 * row replaces this port with a narrower one at the GitHub boundary (ADR-0003),
 * and the module — not its caller — will own the decision.
 */
export interface ConfigResolver {
	resolve(repository: RepositoryAddress): Promise<ConfigResolution>
}
