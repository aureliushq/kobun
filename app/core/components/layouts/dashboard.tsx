import { eq } from "drizzle-orm"
import { Outlet, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { fetchReleaseInfo } from "@/core/release-info.server"
import { project } from "@/db/schema/app-schema"
import { ScrollArea } from "@/ui/components/base/scroll-area"
import { SidebarProvider } from "@/ui/components/base/sidebar"
import DashboardHeader from "@/ui/components/blocks/dashboard-header"
import DashboardSidebar from "@/ui/components/blocks/dashboard-sidebar"
import { PATHS } from "@/ui/lib/constants"
import { DashboardActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/dashboard"

/**
 * The chrome around every content page answers to the same seam the pages do,
 * so the sidebar can never offer a Project the page inside it refuses — nor
 * spend a GitHub round-trip re-reading a Config the page has already resolved.
 */
export async function loader({
	context,
	params,
	request,
	url,
}: Route.LoaderArgs) {
	const { config, db, projectRow, session } = await requirePageContext({
		context,
		params,
		request,
	})

	// The seam answers about one Project; the repository switcher asks for all of
	// them. Lists are the caller's job, so this query stays here rather than
	// widening what every content route resolves.
	const projects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
		with: { githubInstallation: true },
	})

	const currentVersion = KOBUN_VERSION
	const appUrl = import.meta.env.VITE_KOBUN_APP_URL
	// Unset or malformed at build time - treat as self-hosted rather than 500ing
	let isHosted = false
	try {
		isHosted = !!appUrl && url.hostname === new URL(appUrl).hostname
	} catch {
		isHosted = false
	}

	return {
		activeProject: projectRow,
		config,
		projects,
		// Streamed, not awaited: a version badge is not worth blocking the page
		// on an origin that may never answer. Started below the guard above, so
		// a request that redirects never leaves a fetch behind it (ADR 0006).
		releaseInfo: fetchReleaseInfo(appUrl, currentVersion),
		user: session.user,
		versionInfo: {
			currentVersion,
			homeUrl: import.meta.env.VITE_KOBUN_HOME_URL,
			isHosted,
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
	const config = loaderData?.config
	return (
		<SidebarProvider>
			<DashboardSidebar
				activeProject={loaderData.activeProject}
				config={config}
				projects={loaderData.projects}
				releaseInfo={loaderData.releaseInfo}
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
