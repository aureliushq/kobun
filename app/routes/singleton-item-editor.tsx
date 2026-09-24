import { Suspense } from "react"
import {
	Await,
	UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
	useParams,
} from "react-router"
import {
	CollectionItemEditor,
	type OpenedContent,
	usePropertiesPanel,
} from "@/core/editor/collection-item-editor"
import { createSingletonRowDrafts } from "@/core/editor/drafts/singleton-row-drafts"
import {
	commitResponse,
	draftRefusalResponse,
	readEditorActionPayload,
	saveResponse,
} from "@/core/editor/editor-action"
import { resolveSingletonEditorContext } from "@/core/editor/singleton-editor-context.server"
import { EditorActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/singleton-item-editor"

export { shouldRevalidate } from "./singleton-editor"

/**
 * The row this URL names, over the Singleton's own Drafts. A key that is not an
 * array, or a position that is not one, names nothing — decided from the schema
 * alone, so it answers 404 before any Source is read.
 */
async function resolveRowEditorContext(
	args: Route.LoaderArgs | Route.ActionArgs,
) {
	const { drafts, name, owner, singleton } =
		await resolveSingletonEditorContext(args)
	const row = createSingletonRowDrafts({
		drafts,
		fieldKey: args.params.field_key,
		itemIndex: args.params.item_index,
		schema: singleton.schema,
	})
	if (!row) throw new Response("Not Found", { status: 404 })
	return { name, owner, row }
}

/**
 * A position past the last row answers 404 the way a Collection Item's missing
 * Slug does: as an `ErrorResponseImpl`, the one error shape the stream keeps.
 */
async function openRow(
	row: Awaited<ReturnType<typeof resolveRowEditorContext>>["row"],
): Promise<OpenedContent> {
	const opened = await row.open()
	if (!opened) throw new ErrorResponseImpl(404, "Not Found", null)
	return opened
}

export async function loader(args: Route.LoaderArgs) {
	const { name, owner, row } = await resolveRowEditorContext(args)

	return {
		canPublish: false,
		// A row has no Body: a Source has one, and it belongs to the Singleton.
		hasBody: false,
		name,
		owner,
		publishDisabledReason: null,
		schema: row.schema,
		// The Source read is slow and decides nothing about whether this page may
		// be seen, so the shell does not wait on it (ADR-0006).
		opened: openRow(row),
	}
}

export async function action(args: Route.ActionArgs) {
	const { row } = await resolveRowEditorContext(args)
	const payload = await readEditorActionPayload(args.request)
	const content = {
		baseFields: payload.baseFields,
		expectedRevision: payload.expectedRevision,
		fields: payload.fields,
	}

	if (payload.intent === EditorActionIntents.SAVE) {
		return saveResponse(await row.save(content))
	}
	// A row renders no Publish: publishing declares the whole Singleton, which is
	// its own editor's to do (ADR-0008).
	if (payload.intent === EditorActionIntents.PUBLISH) {
		throw new Response("A singleton row has no publish", { status: 400 })
	}

	const committed = await row.commit(content)
	if (!committed.ok) return draftRefusalResponse(committed)
	return commitResponse(committed, {})
}

export default function SingletonItemEditor({
	loaderData,
}: Route.ComponentProps) {
	const params = useParams()
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
		// Keyed on the row the URL names, for the Singleton editor's reason: moving
		// to another row must fall back rather than hold this one on screen.
		<Suspense
			key={`${params.singleton_slug}/${params.field_key}/${params.item_index}`}
			fallback={<CollectionItemEditor {...chrome} mode="item" opened={null} />}
		>
			{/* No `errorElement`: a row that is not there rethrows its 404 to the
			    route's boundary rather than leaving an empty editor behind. */}
			<Await resolve={loaderData.opened}>
				{(opened: OpenedContent) => (
					<CollectionItemEditor {...chrome} mode="item" opened={opened} />
				)}
			</Await>
		</Suspense>
	)
}
