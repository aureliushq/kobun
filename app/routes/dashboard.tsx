import { and, eq } from "drizzle-orm"
import { AlertCircleIcon } from "lucide-react"
import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema"
import { ConfigStatus } from "@/db/types"
import { getGithubFileContent } from "@/github/octokit.server"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"
import { CONFIG_PATHS, PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/dashboard"

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const { owner, name } = params
	const currentProject = await db.query.project.findFirst({
		where: and(
			eq(project.userId, session.user.id),
			eq(project.repoOwnerLogin, owner),
			eq(project.repoName, name),
		),
		with: { githubInstallation: true },
	})

	if (!currentProject) throw redirect(PATHS.SETUP)

	let config:
		| ({ sha: string; path: string; content: string } & {
				error: string | null
				status: ConfigStatus
		  })
		| { path?: string; status: ConfigStatus; error?: string | null } = {
		status: ConfigStatus.MISSING,
	}
	for (const configPath of CONFIG_PATHS) {
		try {
			const configFile = await getGithubFileContent(
				env,
				currentProject?.githubInstallation?.githubInstallationId,
				owner,
				name,
				configPath,
			)
			config = { ...configFile, error: null, status: ConfigStatus.PRESENT }
			break
		} catch (error) {
			if (error instanceof Error && "status" in error && error.status === 404) {
				continue
			}
			config = {
				status: ConfigStatus.ERROR,
				error: error instanceof Error ? error.message : String(error),
			}
			break
		}
	}

	return { config }
}

export default function IndexRoute({ loaderData }: Route.ComponentProps) {
	const config = loaderData.config

	if (config.status === ConfigStatus.MISSING) {
		return (
			<div className="pt-3">
				<Alert variant="destructive" className="w-full">
					<AlertCircleIcon />
					<AlertTitle>Configuration file missing</AlertTitle>
					<AlertDescription>
						Kobun needs a{" "}
						<code className="relative inline break-words rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
							.kobun.json
						</code>{" "}
						or a{" "}
						<code className="relative inline break-words rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
							.kobun.yml
						</code>{" "}
						to work. Please add it in your project root. Once the configuration
						file is in your main branch, come back here and refresh this page.{" "}
						<a href="https://kobun.io/docs/configuration">
							Learn more about configuring Kobun.
						</a>
					</AlertDescription>
				</Alert>
			</div>
		)
	}

	return <div>Welcome!</div>
}
