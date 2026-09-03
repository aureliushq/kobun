import { Suspense } from "react"
import {
	Await,
	UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
	type ShouldRevalidateFunctionArgs,
	useParams,
} from "react-router"
import {
	CollectionItemEditor,
	type OpenedContent,
	usePropertiesPanel,
} from "@/core/editor/collection-item-editor"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import {
	type DraftRefusal,
	type DraftTarget,
	getCollectionPath,
	isDraftAdoptionNavigation,
	type SaveInput,
} from "@/core/editor/drafts"
import { createDrafts } from "@/core/editor/drafts/create-drafts.server"
import { createGithubSourceStore } from "@/core/editor/drafts/github-source-store.server"
import type { OpenResult } from "@/core/editor/drafts/types"
import { requireCollection } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { posthogContext } from "@/lib/posthog-middleware"
import { EditorActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/collection-editor"

/**
 * The seam, plus what it deliberately leaves to its callers: which Collection
 * this URL names, the editor's own rule that a rich-text editor may only open a
 * document Format, and the SourceStore the drafts module commits through
 * (ADR-0001). The md/mdx gate is an editor concern rather than a Project
 * Context one, so it stays here, layered on top of the narrower.
 */
async function resolveCollectionEditorContext({
	context,
	params,
	request,
}: Route.LoaderArgs | Route.ActionArgs) {
	const { collection_slug } = params
	const ctx = await requirePageContext({ context, params, request })
	const { collection, directoryPath } = requireCollection(ctx, collection_slug)
	if (collection.format !== "md" && collection.format !== "mdx") {
		throw new Response("Rich text editing requires an md or mdx collection", {
			status: 422,
		})
	}

	const { db, env, installationId, name, owner, projectRow } = ctx
	return {
		collection,
		collectionSlug: collection_slug,
		db,
		directoryPath,
		env,
		installationId,
		name,
		owner,
		projectRow,
		sourceStore: createGithubSourceStore({ env, installationId, name, owner }),
	}
}

/** Where the writer came from, and where a publish sends them back to. */
function collectionPathFor(
	resolved: Awaited<ReturnType<typeof resolveCollectionEditorContext>>,
) {
	return getCollectionPath(
		{ repoName: resolved.name, repoOwnerLogin: resolved.owner },
		resolved.collectionSlug,
	)
}

function createDraftsFor(
	resolved: Awaited<ReturnType<typeof resolveCollectionEditorContext>>,
) {
	return createDrafts({
		collection: resolved.collection,
		collectionSlug: resolved.collectionSlug,
		db: resolved.db,
		directoryPath: resolved.directoryPath,
		project: { id: resolved.projectRow.id },
		sourceStore: resolved.sourceStore,
	})
}

const STALE_SOURCE_MESSAGE =
	"This item changed on GitHub. Copy your draft or discard it before reloading."

/**
 * The module's refusal code -> HTTP map (ADR-0001), the only one the route
 * owns. Every refusal answers in the same shape, so the editor reads one error
 * the same way whichever intent and whichever gate produced it.
 */
function draftRefusalResponse(refusal: DraftRefusal) {
	switch (refusal.code) {
		case "duplicate-slug":
			return Response.json(
				{
					ok: false,
					error: `Another item already uses slug “${refusal.slug}”`,
				},
				{ status: 409 },
			)
		case "not-found":
			return Response.json(
				{ ok: false, error: "Draft not found" },
				{ status: 404 },
			)
		case "revision-conflict":
			return Response.json(
				{ ok: false, error: "Draft changed in another session" },
				{ status: 409 },
			)
		case "stale-source":
			return Response.json(
				{ ok: false, error: STALE_SOURCE_MESSAGE },
				{ status: 409 },
			)
		case "validation":
			return Response.json(
				{ ok: false, error: refusal.errors.join("\n") },
				{ status: 422 },
			)
	}
}

/**
 * What the request addressed: a new item's Draft, carried in the URL or the
 * payload because nothing in the repository names it yet, or an existing item's
 * Slug. Locating the Source behind that Slug is the module's business.
 */
function getDraftTarget(
	params: Route.LoaderArgs["params"],
	draftId: string | null,
): DraftTarget {
	if (params.editor_mode === "new") return { draftId, mode: "new" }
	if (params.editor_mode === "item" && params.collection_item_slug) {
		return { mode: "item", slug: params.collection_item_slug }
	}
	throw new Response("Not Found", { status: 404 })
}

/**
 * A new item's Draft is minted by its first save, and the editor puts the id it
 * returns in the URL so a reload can find it again. That navigation changes the
 * URL and nothing else — the editor is already holding what the loader would
 * answer with — so re-running the loader would only race the writer's typing.
 */
export function shouldRevalidate({
	currentUrl,
	defaultShouldRevalidate,
	nextUrl,
}: ShouldRevalidateFunctionArgs) {
	if (isDraftAdoptionNavigation(currentUrl, nextUrl)) return false
	return defaultShouldRevalidate
}

/** The half of `open`'s answer the editor actually opens with. */
function openedContent(
	opened: Extract<OpenResult, { ok: true }>,
): OpenedContent {
	return {
		content: opened.content,
		draftId: opened.draftId,
		fields: opened.fields,
		revision: opened.revision,
	}
}

/**
 * One GraphQL call that pulls the full text of every file in the Collection's
 * directory, then a frontmatter parse to find the Slug, then the Draft that
 * tracks it. None of it decides whether this page may be seen, so the page does
 * not wait on it (ADR 0006).
 *
 * A Slug this Collection no longer holds still answers 404, and a GitHub failure
 * still answers the way it did before the split: both reject, and the `Await`
 * below carries no `errorElement`, so both reach the route's error boundary.
 * The 404 travels as an `ErrorResponseImpl` because that is the one error shape
 * the turbo-stream encoder preserves — a thrown `Response` serialises to an
 * empty object, and a plain `Error` is sanitized to "Unexpected Server Error"
 * outside development, which is right for a failure and wrong for a 404.
 */
export async function openCollectionItem(
	drafts: ReturnType<typeof createDraftsFor>,
	target: DraftTarget,
): Promise<OpenedContent> {
	const opened = await drafts.open(target)
	if (!opened.ok) throw new ErrorResponseImpl(404, "Not Found", null)
	return openedContent(opened)
}

export async function loader(args: Route.LoaderArgs) {
	const resolved = await resolveCollectionEditorContext(args)

	// `args.url` is React Router's normalized URL (no `.data` suffix or
	// index/_routes params), so `?draft=` is where the editor put it.
	const draftId = new URL(args.url).searchParams.get("draft")
	const target = getDraftTarget(args.params, draftId)

	// Everything the shell is built from, and the only half that may redirect.
	const shell = {
		canPublish: true,
		name: resolved.name,
		owner: resolved.owner,
		publishDisabledReason: null,
		schema: resolved.collection.schema,
	}
	const drafts = createDraftsFor(resolved)

	// A new item has no Source to fetch: at most one D1 lookup, never GitHub, and
	// the only thing that can 404 a `?draft=` somebody has since discarded. It
	// stays awaited, so this page has no pending state to stand in for.
	if (target.mode === "new") {
		const opened = await drafts.open(target)
		if (!opened.ok) throw draftRefusalResponse(opened)
		return { ...shell, mode: "new" as const, opened: openedContent(opened) }
	}

	return {
		...shell,
		mode: "item" as const,
		// Started below the guards — a promise above one is a request nobody reads.
		opened: openCollectionItem(drafts, target),
	}
}

interface EditorActionPayload {
	draftId?: string | null
	expectedRevision: number | null
	intent: EditorActionIntents
	markdown: string
	fields: FieldRecord
}

async function readActionPayload(
	request: Request,
): Promise<EditorActionPayload> {
	const value = (await request.json()) as Partial<EditorActionPayload>
	if (
		(value.intent !== EditorActionIntents.SAVE &&
			value.intent !== EditorActionIntents.PUBLISH) ||
		typeof value.markdown !== "string" ||
		!value.fields ||
		typeof value.fields !== "object" ||
		Array.isArray(value.fields)
	) {
		throw new Response("Invalid editor action", { status: 400 })
	}
	return {
		draftId: typeof value.draftId === "string" ? value.draftId : null,
		expectedRevision:
			typeof value.expectedRevision === "number"
				? value.expectedRevision
				: null,
		intent: value.intent,
		markdown: value.markdown,
		fields: value.fields as FieldRecord,
	}
}

export async function action(args: Route.ActionArgs) {
	const resolved = await resolveCollectionEditorContext(args)
	const payload = await readActionPayload(args.request)
	const target = getDraftTarget(args.params, payload.draftId ?? null)
	const drafts = createDraftsFor(resolved)
	const input: SaveInput = {
		...target,
		expectedRevision: payload.expectedRevision,
		fields: payload.fields,
		markdown: payload.markdown,
	}

	if (payload.intent === EditorActionIntents.SAVE) {
		const saved = await drafts.save(input)
		if (!saved.ok) return draftRefusalResponse(saved)
		// Nothing was kept, so there is no Draft to name and no Revision to move on
		// to: the content matched the Source, or nobody has typed into the new item
		// yet.
		if (saved.outcome === "matches-source" || saved.outcome === "unwritten") {
			return Response.json({
				ok: true,
				commitSha: null,
				draftId: saved.draftId,
				revision: saved.revision,
			})
		}
		return Response.json({
			ok: true,
			draftId: saved.draft.id,
			revision: saved.draft.revision,
		})
	}

	const published = await drafts.publish(input)
	if (!published.ok) return draftRefusalResponse(published)

	// Publishing ends the editing session: the writer goes back to the list they
	// came from, whichever way the publish landed.
	const collectionPath = collectionPathFor(resolved)
	if (published.outcome === "matches-source") {
		return Response.json({
			ok: true,
			commitSha: null,
			draftDeleted: true,
			draftId: published.draftId,
			collectionPath,
		})
	}
	if (published.outcome === "published-unsynced") {
		return Response.json({
			ok: true,
			commitSha: published.commitSha,
			draftId: published.draftId,
			draftSynced: false,
			collectionPath,
		})
	}
	// A publish that reached the repository and reconciled its Draft. The two
	// outcomes above return before this: one committed nothing, the other lost
	// the sync race — neither was tracked before the lifecycle moved into the
	// module, and this merge is not the place to start.
	const posthog = args.context.get(posthogContext)
	posthog?.capture({
		event: "content_published",
		properties: {
			collection_slug: resolved.collectionSlug,
			repo_owner: resolved.owner,
			repo_name: resolved.name,
			editor_mode: target.mode,
		},
	})

	return Response.json({
		ok: true,
		commitSha: published.commitSha,
		draftDeleted: published.draftDeleted,
		draftId: published.draftId,
		revision: published.revision,
		collectionPath,
	})
}

export default function CollectionEditor({ loaderData }: Route.ComponentProps) {
	const { canPublish, name, owner, publishDisabledReason, schema } = loaderData
	const params = useParams()
	// Above the boundary, so the panel keeps whatever the writer set while the
	// content was still on its way.
	const panel = usePropertiesPanel()
	const chrome = {
		canPublish,
		name,
		owner,
		panel,
		publishDisabledReason,
		schema,
	}

	// A new item's content was awaited, so there is no boundary here at all and
	// therefore no placeholder to fall back to.
	if (loaderData.mode === "new") {
		return (
			<CollectionItemEditor {...chrome} mode="new" opened={loaderData.opened} />
		)
	}

	return (
		// Keyed by the item the URL names, and on the `Suspense` rather than the
		// `Await`: navigating between two items suspends over a boundary that has
		// already revealed content, and React answers that by delaying the whole
		// commit rather than falling back. The key is built from the path params
		// and never from the search — `?draft=` moves under the writer as the
		// first save mints a Draft, and a key that noticed would remount the
		// editor, destroying the document being typed into.
		<Suspense
			key={`${params.collection_slug}/${params.collection_item_slug}`}
			fallback={<CollectionItemEditor {...chrome} mode="item" opened={null} />}
		>
			{/* No `errorElement`, which is ADR 0006's rule one taken deliberately
			    the other way: the rule exists to stop a failed section taking
			    down the shell around it, and here the shell is an editor with
			    nothing to edit. A Slug that names nothing must still answer 404
			    and a failed read must still answer the way it did before the
			    split, so both rethrow past this to the route's boundary. */}
			<Await resolve={loaderData.opened}>
				{(resolved: OpenedContent) => (
					<CollectionItemEditor {...chrome} mode="item" opened={resolved} />
				)}
			</Await>
		</Suspense>
	)
}
