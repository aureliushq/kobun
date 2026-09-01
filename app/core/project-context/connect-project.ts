import { eq } from "drizzle-orm"
import { githubInstallation, project } from "@/db/schema/app-schema"
import {
	ConfigStatus,
	type GithubInstallation,
	type Project,
	ProjectStatus,
} from "@/db/types"
import { CONFIG_PATHS } from "@/ui/lib/constants"
import { SetupActionErrors } from "@/ui/lib/types"
import type { ProjectContextDatabase } from "./types"

/**
 * The part of GitHub's repository listing that connecting one reads. Kept in
 * the wire shape rather than mapped into domain names, so the route hands the
 * listing straight over and the fake in the tests is the same shape as the real
 * thing rather than a translation of it.
 */
export interface ConnectableRepository {
	html_url: string
	id: number
	name: string
	owner: { login: string }
}

/**
 * The two things connecting a repository has to go out and do. Both are ports
 * for the same reason `ConfigSource` is (ADR-0001): the upsert and the identity
 * of the row it writes are the subject under test, and neither should need a
 * GitHub client to exercise.
 */
export interface ConnectProjectDeps {
	db: ProjectContextDatabase
	listRepositories(
		installation: GithubInstallation,
	): Promise<ConnectableRepository[]>
	syncConfig(connected: Project): Promise<unknown>
}

export interface ConnectProjectInput {
	installationId: string
	repoId: string
	userId: string
}

/**
 * Where the writer goes next, or why they cannot go anywhere. Reported rather
 * than thrown, so the route decides what a refusal looks like on the page.
 */
export type ConnectProjectResult =
	| { error: SetupActionErrors; ok: false }
	| { ok: true; path: string; repoName: string; repoOwnerLogin: string }

/**
 * Connect a repository to this user: the write half of the Project seam. The
 * row says which repository this Project is and nothing about what is in it —
 * the two Config columns are `NOT NULL` and so must say something, and they say
 * the row has never been looked at. The sync that follows is what looks, so
 * connecting and the dashboard's refresh are the same act and go the same way
 * (ADR-0003).
 *
 * Re-connecting a repository already connected is an ordinary thing to do, and
 * upserting on the Project's own unique index is what makes it land on the same
 * row rather than a second one.
 */
export async function connectProject(
	{ db, listRepositories, syncConfig }: ConnectProjectDeps,
	{ installationId, repoId, userId }: ConnectProjectInput,
): Promise<ConnectProjectResult> {
	const installation = await db.query.githubInstallation.findFirst({
		where: eq(githubInstallation.id, installationId),
	})

	if (!installation)
		return { error: SetupActionErrors.INSTALLATION_NOT_FOUND, ok: false }

	if (installation.deletedAt || installation.suspendedAt)
		return { error: SetupActionErrors.INSTALLATION_SUSPENDED, ok: false }

	const repos = await listRepositories(installation)
	const selectedRepo = repos.find((repo) => String(repo.id) === repoId)

	if (!selectedRepo)
		return { error: SetupActionErrors.REPO_NOT_FOUND, ok: false }

	// The id below is only ever the one a new row gets: the conflict target is
	// this user and this repository, so a row that already exists takes the
	// update arm and keeps the id it has.
	const [connectedProject] = await db
		.insert(project)
		.values({
			configPath: CONFIG_PATHS[0],
			configStatus: ConfigStatus.UNKNOWN,
			id: crypto.randomUUID(),
			installationId: installation.id,
			repoHtmlUrl: selectedRepo.html_url,
			repoId: String(selectedRepo.id),
			repoName: selectedRepo.name,
			repoOwnerLogin: selectedRepo.owner.login,
			status: ProjectStatus.ACTIVE,
			userId,
		})
		.onConflictDoUpdate({
			target: [project.userId, project.repoId],
			set: {
				installationId: installation.id,
				repoHtmlUrl: selectedRepo.html_url,
				repoName: selectedRepo.name,
				repoOwnerLogin: selectedRepo.owner.login,
				status: ProjectStatus.ACTIVE,
			},
		})
		.returning()

	await syncConfig(connectedProject)

	return {
		ok: true,
		path: `/${selectedRepo.owner.login}/${selectedRepo.name}`,
		repoName: selectedRepo.name,
		repoOwnerLogin: selectedRepo.owner.login,
	}
}
