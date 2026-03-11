import { eq } from "drizzle-orm"
import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project, userInstallation } from "@/db/schema"
import { listGithubInstallationRepositories } from "@/github/octokit.server"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/setup"

export async function loader({ context, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const url = new URL(request.url)
	const githubInstallationId = url.searchParams.get("installation_id")
	// const state = url.searchParams.get("state")

	// TODO: handle post-install callback
	if (githubInstallationId) {
	}

	const linkedInstallations = await db.query.userInstallation.findMany({
		where: eq(userInstallation.userId, session.user.id),
		with: { githubInstallation: true },
	})

	const installationsWithRepos = await Promise.all(
		linkedInstallations
			.filter((li) => !li.githubInstallation.deletedAt)
			.map(async (li) => {
				const repos = await listGithubInstallationRepositories(
					env,
					li.githubInstallation.githubInstallationId,
				)
				return {
					installation: li.githubInstallation,
					repos,
				}
			}),
	)

	const projects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
	})

	const projectsByRepoId = new Map(
		projects.map((project) => [project.githubRepoId, project]),
	)

	return {
		user: session.user,
		installations: installationsWithRepos.map((iwr) => ({
			...iwr,
			repos: iwr.repos.map((repo) => ({
				...repo,
				project: projectsByRepoId.get(String(repo.id)) ?? null,
			})),
		})),
		installUrl: null,
	}
}

export default function Onboarding() {
	return <div>Onboarding</div>
}
