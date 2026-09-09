import { eq } from "drizzle-orm"
import { Outlet } from "react-router"
import { usePreferences } from "@/core/preferences/context"
import { requireProjectPage } from "@/core/project-context/project-context.server"
import { fetchReleaseInfo } from "@/core/release-info.server"
import { project } from "@/db/schema/app-schema"
import { ScrollArea } from "@/ui/components/base/scroll-area"
import { SidebarProvider } from "@/ui/components/base/sidebar"
import DashboardHeader from "@/ui/components/blocks/dashboard-header"
import DashboardSidebar from "@/ui/components/blocks/dashboard-sidebar"
import type { Route } from "./+types/dashboard"

/**
 * The chrome around every content page answers to the same seam the pages do,
 * so the sidebar can never offer a Project the page inside it refuses — nor
 * spend a GitHub round-trip re-reading a Config the page has already resolved.
 *
 * This is the one layout that resolves a Project without demanding a Config
 * (ADR-0007): the page below it reports a Config it could not read, and a
 * reader sent away from here has nowhere left to be sent.
 */
export async function loader({
	context,
	params,
	request,
	url,
}: Route.LoaderArgs) {
	const ctx = await requireProjectPage({ context, params, request })
	const { config, db, projectRow, session } = ctx

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
		// What the page below renders when there is no Config to render from.
		configProblem: ctx.config ? null : ctx.configProblem,
		projects,
		// Streamed, not awaited: a version badge is not worth blocking the page
		// on an origin that may never answer. Started below the guard above, so
		// a request that redirects never leaves a fetch behind it (ADR 0006).
		releaseInfo: fetchReleaseInfo(appUrl, currentVersion),
		// Narrowed to the three fields the chrome draws — the sidebar footer's
		// user menu, and the dashboard's greeting — rather than publishing the
		// whole session row to the browser (#138).
		user: {
			email: session.user.email,
			image: session.user.image ?? null,
			name: session.user.name,
		},
		versionInfo: {
			currentVersion,
			homeUrl: import.meta.env.VITE_KOBUN_HOME_URL,
			isHosted,
		},
	}
}

const DashboardLayout = ({ loaderData }: Route.ComponentProps) => {
	const config = loaderData?.config
	// A starting state, not a live one: the switch says "whether the sidebar
	// starts expanded", and toggling it here is this visit's business.
	const { sidebarOpen } = usePreferences()
	return (
		<SidebarProvider defaultOpen={sidebarOpen}>
			<DashboardSidebar
				activeProject={loaderData.activeProject}
				config={config}
				projects={loaderData.projects}
				releaseInfo={loaderData.releaseInfo}
				user={loaderData.user}
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
