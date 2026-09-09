import type { ConfigError, Format, NormalizedConfig } from "@/config/types"
import type { ConfigProblem } from "@/core/project-context"
import { configErrors } from "@/core/project-context/config-errors"
import { ConfigStatus, type Project } from "@/db/types"

/** One Collection or Singleton, as a settings page lists it. */
export interface DeclaredEntity {
	format: Format
	label: string
	slug: string
}

export interface ProjectConfigView {
	collections: DeclaredEntity[]
	errors: ConfigError[]
	/** The Config file on GitHub, or null when there is no file to point at. */
	fileUrl: string | null
	lastCheckedAt: Date | null
	path: string
	singletons: DeclaredEntity[]
	status: ConfigStatus
}

/** The columns this view reads. Everything else on the row belongs elsewhere. */
type ConfigRow = Pick<
	Project,
	| "configCheckedAt"
	| "configError"
	| "configPath"
	| "configStatus"
	| "repoHtmlUrl"
>

function declared(
	entities: Record<string, { format: Format; label: string }>,
): DeclaredEntity[] {
	return Object.entries(entities).map(([slug, entity]) => ({
		format: entity.format,
		label: entity.label,
		slug,
	}))
}

/**
 * What the Project settings page has to say about a repository's Config.
 *
 * It lists only a Config that resolved. A Project whose Config is missing or
 * broken still has this page — it is the page that most needs to work then
 * (ADR-0007) — but a Config Kobun could not use declares nothing it can honestly
 * list, so the errors stand in its place rather than a stale list from the last
 * time it worked.
 *
 * Nothing here is editable, and nothing here writes: Collections, Singletons and
 * their formats are the repository's to declare, and this page shows them and
 * links to the file (ADR-0010).
 */
export function describeProjectConfig(
	project: ConfigRow,
	config: NormalizedConfig | null,
	problem: ConfigProblem | null,
): ProjectConfigView {
	return {
		collections: config ? declared(config.collections) : [],
		errors: configErrors(config, problem, project.configError),
		// A repository that holds no Config leaves `configPath` naming the first
		// candidate path rather than a file, so there is nothing to link to.
		fileUrl:
			project.configStatus === ConfigStatus.MISSING
				? null
				: `${project.repoHtmlUrl}/blob/HEAD/${project.configPath}`,
		lastCheckedAt: project.configCheckedAt,
		path: project.configPath,
		singletons: config ? declared(config.singletons) : [],
		// `config_status` is a `text` column rather than an enum, the way every
		// status in `packages/db/types.ts` is; this is the one place the page
		// takes what the sync wrote at its word.
		status: project.configStatus as ConfigStatus,
	}
}
