import { getSingletonEditorPath, getSingletonPath } from "@/core/editor/drafts"
import { createSingletonDrafts } from "@/core/editor/drafts/create-drafts.server"
import { createGithubSourceStore } from "@/core/editor/drafts/github-source-store.server"
import { createR2StagedImageStore } from "@/core/editor/drafts/r2-staged-image-store.server"
import { requireSingleton } from "@/core/project-context"
import {
	type ProjectContextArgs,
	requirePageContext,
} from "@/core/project-context/project-context.server"

/**
 * The Singleton this URL names and the SourceStore its Drafts commit through
 * (ADR-0001). A Singleton is listed nowhere, so unlike a Collection there is no
 * listing cache for a commit to invalidate.
 */
export async function resolveSingletonEditorContext({
	context,
	params,
	request,
}: ProjectContextArgs & { params: { singleton_slug: string } }) {
	const ctx = await requirePageContext({ context, params, request })
	const { filePath, singleton } = requireSingleton(ctx, params.singleton_slug)
	const { db, env, installationId, name, owner, projectRow } = ctx
	const project = { repoName: name, repoOwnerLogin: owner }
	const singletonPath = getSingletonPath(project, params.singleton_slug)
	const editorPath = getSingletonEditorPath(project, params.singleton_slug)

	return {
		editorPath,
		// Where committed images are, for the editor's previews.
		media: { path: ctx.config.mediaPath, url: ctx.config.mediaUrl },
		drafts: createSingletonDrafts({
			db,
			filePath,
			project: { id: projectRow.id },
			singleton,
			singletonSlug: params.singleton_slug,
			sourceStore: createGithubSourceStore({
				env,
				installationId,
				name,
				owner,
			}),
			stagedImages: createR2StagedImageStore({
				bucket: env.IMAGES,
				mediaPath: ctx.config.mediaPath,
				mediaUrl: ctx.config.mediaUrl,
				name,
				owner,
				projectId: projectRow.id,
			}),
		}),
		name,
		owner,
		singleton,
		// Where a publish sends the writer back to.
		singletonPath,
	}
}
