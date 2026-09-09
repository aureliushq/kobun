import { desc, eq } from "drizzle-orm"
import { ChevronLeft } from "lucide-react"
import { Link, Outlet, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema/app-schema"
import { Button } from "@/ui/components/base/button"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/settings"
import { chooseBackDestination } from "./settings-back-destination"

/**
 * The chrome around the account settings page.
 *
 * A layout of its own beside the dashboard, editor and minimal ones, because
 * `/settings` is about the account rather than a Project and so has no
 * `owner`/`name` to resolve one from (ADR-0010). That also puts it outside
 * every `require*` wrapper in `project-context.server.ts`, each of which
 * demands those params, so the session is checked here the way the other
 * Project-less routes check it — `routes/index.tsx` and `routes/setup.tsx` do
 * the same.
 */
export async function loader({ context, request, url }: Route.LoaderArgs) {
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	// Most recently updated first, the same ordering `routes/setup.tsx` calls
	// its recent Projects. `updatedAt` is bumped by any write to the row - a
	// Config sync as much as a visit - so this is a reasonable first guess at
	// where the writer belongs, not a record of where they last were.
	const projects = await context.get(dbContext).query.project.findMany({
		where: eq(project.userId, session.user.id),
		orderBy: desc(project.updatedAt),
	})

	return {
		back: chooseBackDestination({
			from: url.searchParams.get("from"),
			projects,
		}),
	}
}

const SettingsLayout = ({ loaderData }: Route.ComponentProps) => {
	const { back } = loaderData

	return (
		<main className="flex h-screen w-screen flex-col divide-y">
			{/* The label sits inside the link rather than beside it: an icon-only
			    way out of a page that names no Project tells a screen reader
			    nothing about where it goes. */}
			<header className="flex h-14 shrink-0 items-center px-6">
				<Button
					className="min-w-0"
					render={<Link prefetch="intent" to={back.to} />}
					size="lg"
					variant="ghost"
				>
					<ChevronLeft />
					<span className="truncate">{back.label}</span>
				</Button>
			</header>
			<section className="flex flex-1 justify-center overflow-auto p-8">
				<div className="flex w-full max-w-4xl flex-col gap-4">
					<Outlet />
				</div>
			</section>
		</main>
	)
}

export default SettingsLayout
