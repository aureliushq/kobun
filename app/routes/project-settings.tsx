import { syncProjectConfig } from "@/config/github.server"
import {
	requireApiAccess,
	requireProjectPage,
} from "@/core/project-context/project-context.server"
import { describeProjectConfig } from "@/core/settings/project-config"
import { ProjectConfigSection } from "@/core/settings/project-config-section"
import { ProjectContentSection } from "@/core/settings/project-content-section"
import { ProjectRepositorySection } from "@/core/settings/project-repository-section"
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
	const { config, projectRow } = ctx

	return {
		config: describeProjectConfig(
			projectRow,
			config,
			config ? null : ctx.configProblem,
		),
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
	// would be asking the repository the same question twice.
	const { db, env, projectRow } = await requireApiAccess({
		context,
		params,
		request,
	})

	const formData = await request.formData()
	if (formData.get("intent") !== SettingsActionIntents.REFRESH_CONFIGURATION) {
		throw new Response("Unknown project settings action", { status: 400 })
	}

	await syncProjectConfig(db, env, projectRow)

	return { ok: true }
}

const ProjectSettings = ({ loaderData }: Route.ComponentProps) => {
	const { config, repository } = loaderData

	return (
		<>
			<h1 className="font-semibold text-2xl">Project settings</h1>
			<ProjectRepositorySection repository={repository} />
			<ProjectConfigSection config={config} />
			<ProjectContentSection
				collections={config.collections}
				singletons={config.singletons}
			/>
		</>
	)
}

export default ProjectSettings
