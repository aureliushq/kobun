import { eq } from "drizzle-orm"
import { Outlet, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { fetchAndParseConfig } from "@/config/github.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema/app-schema"
import type { ProjectWithGithubInstallation } from "@/db/types"
import { ScrollArea } from "@/ui/components/base/scroll-area"
import { SidebarProvider } from "@/ui/components/base/sidebar"
import DashboardHeader from "@/ui/components/blocks/dashboard-header"
import DashboardSidebar from "@/ui/components/blocks/dashboard-sidebar"
import { PATHS } from "@/ui/lib/constants"
import { DashboardActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/dashboard"

export async function loader({
	context,
	params,
	request,
	url,
}: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const { owner, name } = params

	const projects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
		with: { githubInstallation: true },
	})
	const activeProject = projects.find(
		(project) => project.repoOwnerLogin === owner && project.repoName === name,
	)

	if (!activeProject) throw redirect(PATHS.SETUP)

	const configResult = await fetchAndParseConfig(
		env,
		activeProject.githubInstallation.githubInstallationId,
		owner,
		name,
	)

	const currentVersion = KOBUN_VERSION
	const isHosted = url.hostname === new URL(env.KOBUN_APP_URL).hostname

	let latestVersion = currentVersion
	let hasUpdate = false
	let releaseUrl = ""
	let changelogUrl = ""

	try {
		const manifestRes = await fetch(`${env.KOBUN_APP_URL}/manifest.json`)
		if (manifestRes.ok) {
			const manifest = (await manifestRes.json()) as {
				version: string
				releaseUrl: string
				changelogUrl: string
			}
			latestVersion = manifest.version
			hasUpdate = manifest.version !== currentVersion
			releaseUrl = manifest.releaseUrl
			changelogUrl = manifest.changelogUrl
		}
	} catch {
		// Manifest fetch failed — silently continue with defaults
	}

	return {
		activeProject,
		configResult,
		projects,
		user: session.user,
		versionInfo: {
			currentVersion,
			latestVersion,
			hasUpdate,
			isHosted,
			releaseUrl,
			changelogUrl,
			homeUrl: env.KOBUN_HOME_URL,
		},
	}
}

export async function action({ context, request }: Route.ActionArgs) {
	const auth = getAuth(context.get(envContext))
	const formData = await request.formData()
	const intent = formData.get("intent")
	if (intent === DashboardActionIntents.LOGOUT) {
		const response = await auth.api.signOut({
			asResponse: true,
			headers: request.headers,
		})
		if (response.ok) {
			return redirect(PATHS.LOGIN, { headers: response.headers })
		}
	}
}

const DashboardLayout = ({ loaderData }: Route.ComponentProps) => {
	const config = loaderData?.configResult?.config

	return (
		<SidebarProvider>
			<DashboardSidebar
				activeProject={
					loaderData.activeProject as ProjectWithGithubInstallation
				}
				config={config}
				projects={loaderData.projects}
				versionInfo={loaderData.versionInfo}
			/>
			<main className="flex h-screen w-screen flex-col divide-y overflow-hidden pb-16">
				<DashboardHeader />
				<ScrollArea className="z-10 h-full w-full p-8">
					<section className="flex w-full justify-center">
						<div className="flex w-full max-w-4xl flex-col gap-4">
							<Outlet />
						</div>
					</section>
				</ScrollArea>
			</main>
		</SidebarProvider>
	)
}

export default DashboardLayout
