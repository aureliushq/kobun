import { eq } from "drizzle-orm"
import { ChevronLeft } from "lucide-react"
import { Form, Link, Outlet, redirect } from "react-router"
import invariant from "tiny-invariant"
import { getAuth } from "@/auth/auth.server"
import { fetchAndParseConfig } from "@/config/github.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema/app-schema"
import { Button } from "@/ui/components/base/button"
import { PATHS } from "@/ui/lib/constants"
import { EditorActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/editor"

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const { owner, name, collection_slug, singleton_slug } = params
	invariant(
		collection_slug || singleton_slug,
		"collection_slug or singleton_slug is required",
	)

	const projects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
		with: { githubInstallation: true },
	})
	const activeProject = projects.find(
		(p) => p.repoOwnerLogin === owner && p.repoName === name,
	)
	if (!activeProject) throw redirect(PATHS.SETUP)

	const configResult = await fetchAndParseConfig(
		env,
		activeProject.githubInstallation.githubInstallationId,
		owner,
		name,
	)
	const config = configResult.config
	invariant(config, "config is required")

	if (singleton_slug) {
		const singleton = config.singletons[singleton_slug]
		invariant(singleton, "singleton is required")
		return {
			parentLabel: singleton.label,
			parentPath: `/${owner}/${name}/singletons/${singleton_slug}`,
		}
	}

	invariant(collection_slug, "collection_slug is required")
	const collection = config.collections[collection_slug]
	invariant(collection, "collection is required")

	return {
		parentLabel: collection.label,
		parentPath: `/${owner}/${name}/collections/${collection_slug}`,
	}
}

const EditorLayout = ({ loaderData }: Route.ComponentProps) => {
	const { parentLabel, parentPath } = loaderData

	return (
		<main className="flex h-screen w-screen flex-col divide-y">
			<header className="flex h-14 shrink-0 items-center justify-between gap-4 px-6">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" render={<Link to={parentPath} />}>
						<ChevronLeft className="size-4" />
					</Button>
					<span className="font-medium text-sm">{parentLabel}</span>
				</div>
				<Form method="post" className="flex items-center gap-2">
					<Button
						type="submit"
						variant="outline"
						name="intent"
						value={EditorActionIntents.SAVE}
					>
						Save
					</Button>
					<Button
						type="submit"
						name="intent"
						value={EditorActionIntents.PUBLISH}
					>
						Publish
					</Button>
				</Form>
			</header>
			<section className="flex-1 overflow-auto">
				<Outlet />
			</section>
		</main>
	)
}

export default EditorLayout
