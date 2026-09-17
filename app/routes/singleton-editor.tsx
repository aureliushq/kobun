import { Suspense } from "react"
import {
	Await,
	type ShouldRevalidateFunctionArgs,
	useParams,
} from "react-router"
import invariant from "tiny-invariant"
import { SET_PRIMARY_ACTION_PATH } from "@/core/components/layouts/use-primary-editor-action"
import {
	CollectionItemEditor,
	type OpenedContent,
	usePropertiesPanel,
} from "@/core/editor/collection-item-editor"
import { createSingletonDrafts } from "@/core/editor/drafts/create-drafts.server"
import { createGithubSourceStore } from "@/core/editor/drafts/github-source-store.server"
import {
	commitResponse,
	draftRefusalResponse,
	openedContent,
	readEditorActionPayload,
	saveResponse,
} from "@/core/editor/editor-action.server"
import { requireSingleton } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { EditorActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/singleton-editor"

/**
 * The Singleton this URL names and the SourceStore its Drafts commit through
 * (ADR-0001). A Singleton is listed nowhere, so unlike a Collection there is no
 * listing cache for a commit to invalidate.
 */
async function resolveSingletonEditorContext({
	context,
	params,
	request,
}: Route.LoaderArgs | Route.ActionArgs) {
	const ctx = await requirePageContext({ context, params, request })
	const { filePath, singleton } = requireSingleton(ctx, params.singleton_slug)
	const { db, env, installationId, name, owner, projectRow } = ctx

	return {
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
		}),
		name,
		owner,
		singleton,
	}
}

/**
 * Choosing which target the header's primary button runs is chrome, and says
 * nothing about the Singleton being edited — re-reading its Source would cost a
 * GitHub round trip for a menu click made mid-sentence.
 */
export function shouldRevalidate({
	defaultShouldRevalidate,
	formAction,
}: ShouldRevalidateFunctionArgs) {
	if (formAction === SET_PRIMARY_ACTION_PATH) return false
	return defaultShouldRevalidate
}

/**
 * A Singleton always opens — on its Source, on its Draft, or on its schema
 * defaults while neither exists — so there is no 404 to carry across the wire.
 */
async function openSingleton(
	drafts: ReturnType<typeof createSingletonDrafts>,
): Promise<OpenedContent> {
	const opened = await drafts.open()
	invariant(opened.ok, "A Singleton always opens")
	return openedContent(opened)
}

export async function loader(args: Route.LoaderArgs) {
	const { drafts, name, owner, singleton } =
		await resolveSingletonEditorContext(args)

	return {
		// A Singleton has no Publication State to declare, so Save to GitHub is
		// its only path to the repository (ADR-0008).
		canPublish: false,
		hasBody: singleton.format === "md" || singleton.format === "mdx",
		name,
		owner,
		publishDisabledReason: null,
		schema: singleton.schema,
		// The Source read is slow and decides nothing about whether this page may
		// be seen, so the shell does not wait on it (ADR-0006).
		opened: openSingleton(drafts),
	}
}

export async function action(args: Route.ActionArgs) {
	const { drafts } = await resolveSingletonEditorContext(args)
	const payload = await readEditorActionPayload(args.request)
	const content = {
		expectedRevision: payload.expectedRevision,
		fields: payload.fields,
		markdown: payload.markdown,
	}

	if (payload.intent === EditorActionIntents.SAVE) {
		return saveResponse(await drafts.save(content))
	}
	// The header renders no Publish for a Singleton, so one arriving here is not
	// a writer's choice (ADR-0008).
	if (payload.intent === EditorActionIntents.PUBLISH) {
		throw new Response("A singleton has no publish feature", { status: 400 })
	}

	const committed = await drafts.commit(content)
	if (!committed.ok) return draftRefusalResponse(committed)
	// The Singleton's path never changes, so the writer stays where they are.
	return commitResponse(committed, {})
}

export default function SingletonEditor({ loaderData }: Route.ComponentProps) {
	const params = useParams()
	// Above the boundary, so the panel keeps whatever the writer set while the
	// content was still on its way.
	const panel = usePropertiesPanel()
	const chrome = {
		canPublish: loaderData.canPublish,
		hasBody: loaderData.hasBody,
		name: loaderData.name,
		owner: loaderData.owner,
		panel,
		publishDisabledReason: loaderData.publishDisabledReason,
		schema: loaderData.schema,
	}

	return (
		// Keyed on the `Suspense`, as the collection editor's is: moving between
		// two Singletons must fall back rather than hold the old one on screen.
		<Suspense
			key={params.singleton_slug}
			fallback={<CollectionItemEditor {...chrome} mode="item" opened={null} />}
		>
			<Await resolve={loaderData.opened}>
				{(opened: OpenedContent) => (
					<CollectionItemEditor {...chrome} mode="item" opened={opened} />
				)}
			</Await>
		</Suspense>
	)
}
