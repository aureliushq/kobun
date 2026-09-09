import { desc, eq } from "drizzle-orm"
import { redirect } from "react-router"
import { syncProjectConfig } from "@/config/github.server"
import { chooseBackDestination } from "@/core/components/layouts/settings-back-destination"
import { countDirtyDrafts } from "@/core/editor/drafts"
import {
	requireApiAccess,
	requireProjectPage,
} from "@/core/project-context/project-context.server"
import { disconnectProject } from "@/core/settings/disconnect-project.server"
import { DisconnectProjectSection } from "@/core/settings/disconnect-project-section"
import { describeProjectConfig } from "@/core/settings/project-config"
import { ProjectConfigSection } from "@/core/settings/project-config-section"
import { ProjectContentSection } from "@/core/settings/project-content-section"
import { ProjectRepositorySection } from "@/core/settings/project-repository-section"
import { project } from "@/db/schema/app-schema"
import { posthogContext } from "@/lib/posthog-middleware"
import { SettingsActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/project-settings"

/**
 * The Project settings page: what the repository's Config declares, and the
 * controls that cannot live in the repository (#136).
 *
 * Resolved with `requireProjectPage`, the one wrapper that hands back a Config
 * it could not read instead of redirecting away from it. A Project with a
 * broken Config still has this page, and needs it more than a working one does
 * (ADR-0007) — the Refresh below is how a Config fixed on GitHub gets read
 * again.
 *
 * It resolves for itself rather than reading the dashboard layout's data, the
 * same way `collection.tsx` and `singleton.tsx` do. Inside the Config cache's
 * window that second resolve is a row read, not a GitHub call (ADR-0003).
 */
export async function loader({ context, params, request }: Route.LoaderArgs) {
	const ctx = await requireProjectPage({ context, params, request })
	const { config, db, projectRow } = ctx

	return {
		config: describeProjectConfig(
			projectRow,
			config,
			config ? null : ctx.configProblem,
		),
		// Awaited: one indexed count over the writer's own rows, lighter than the
		// Projects list the layout already waits for, and Disconnect is not
		// allowed to ask its question without it.
		dirtyDraftCount: await countDirtyDrafts(db, projectRow.id),
		repository: {
			htmlUrl: projectRow.repoHtmlUrl,
			name: projectRow.repoName,
			owner: projectRow.repoOwnerLogin,
		},
	}
}

export async function action({ context, params, request }: Route.ActionArgs) {
	// Resolved before the form is read, the way `routes/settings.tsx` does it —
	// and resolved without the Config, which is the one wrapper choice this
	// action gets to make: revalidating a Config on the way to re-reading it
	// would be asking the repository the same question twice, and a Project on
	// its way out has no use for one at all.
	const { db, env, projectRow, session } = await requireApiAccess({
		context,
		params,
		request,
	})

	const formData = await request.formData()
	const intent = formData.get("intent")

	if (intent === SettingsActionIntents.REFRESH_CONFIGURATION) {
		await syncProjectConfig(db, env, projectRow)
		return { ok: true }
	}

	if (intent === SettingsActionIntents.DISCONNECT_PROJECT) {
		const slug = `${projectRow.repoOwnerLogin}/${projectRow.repoName}`
		const confirmation = formData.get("confirmation")
		if (
			typeof confirmation !== "string" ||
			confirmation.trim().toLowerCase() !== slug.toLowerCase()
		) {
			// The dialog's own button will not submit until the phrase matches, so
			// a submission that names the wrong one did not come from the page —
			// the same reading `routes/settings.tsx` gives a revoke naming the
			// current session.
			throw new Response("That is not this repository's name", { status: 400 })
		}

		context.get(posthogContext)?.capture({ event: "project_disconnected" })
		await disconnectProject(db, projectRow.id)

		// The page the writer is standing on no longer exists, so somewhere that
		// still does has to be chosen for them. `chooseBackDestination` already
		// answers exactly this question for `/settings`: the writer's most
		// recently updated Project, or setup when that was the last one.
		const remaining = await db.query.project.findMany({
			columns: { repoName: true, repoOwnerLogin: true },
			orderBy: desc(project.updatedAt),
			where: eq(project.userId, session.user.id),
		})
		return redirect(
			chooseBackDestination({ from: null, projects: remaining }).to,
		)
	}

	throw new Response("Unknown project settings action", { status: 400 })
}

const ProjectSettings = ({ loaderData }: Route.ComponentProps) => {
	const { config, dirtyDraftCount, repository } = loaderData

	return (
		<>
			<h1 className="font-semibold text-2xl">Project settings</h1>
			<ProjectRepositorySection repository={repository} />
			<ProjectConfigSection config={config} />
			<ProjectContentSection
				collections={config.collections}
				singletons={config.singletons}
			/>
			<DisconnectProjectSection
				dirtyDraftCount={dirtyDraftCount}
				repository={repository}
			/>
		</>
	)
}

export default ProjectSettings
