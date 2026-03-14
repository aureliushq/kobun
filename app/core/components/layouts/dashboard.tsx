import { eq } from "drizzle-orm"
import { Outlet, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
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

export async function loader({ context, params, request }: Route.LoaderArgs) {
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

	return { activeProject, projects, user: session.user }
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
	return (
		<SidebarProvider>
			<DashboardSidebar
				activeProject={
					loaderData.activeProject as ProjectWithGithubInstallation
				}
				projects={loaderData.projects}
			/>
			<main className="flex h-screen w-screen flex-col divide-y">
				<DashboardHeader />
				<ScrollArea className="z-10 h-full w-full p-8">
					<section className="flex w-full justify-center">
						<div className="flex w-full max-w-6xl flex-col gap-4">
							<Outlet />
						</div>
					</section>
				</ScrollArea>
			</main>
		</SidebarProvider>
	)
}

export default DashboardLayout
