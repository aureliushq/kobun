import type { Editor } from "@tiptap/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	type ShouldRevalidateFunctionArgs,
	useLocation,
	useNavigate,
} from "react-router"
import { useEditorLayoutControls } from "@/core/components/layouts/editor-context"
import { canonicalMetadata } from "@/core/content"
import {
	type FieldRecord,
	getCollectionEditorFields,
	updateMetadataField,
} from "@/core/editor/collection-metadata"
import { MetadataField } from "@/core/editor/collection-metadata-fields"
import { CollectionTitleField } from "@/core/editor/collection-title-field"
import {
	type DraftRefusal,
	type DraftTarget,
	getCollectionPath,
	isDraftAdoptionNavigation,
	type SaveInput,
} from "@/core/editor/drafts"
import { createDrafts } from "@/core/editor/drafts/create-drafts.server"
import { createGithubSourceStore } from "@/core/editor/drafts/github-source-store.server"
import { requireCollection } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import {
	type AutosaveState,
	type EditorRefApi,
	EditorWordCount,
	RichTextEditor,
} from "@/editor"
import { posthogContext } from "@/lib/posthog-middleware"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/ui/components/base/sheet"
import { useIsMobile } from "@/ui/hooks/use-mobile"
import { EditorActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/collection-editor"

const initialAutosaveState: AutosaveState = {
	isDirty: false,
	isSaving: false,
	lastSavedAt: null,
}

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

export async function loader(args: Route.LoaderArgs) {
	const resolved = await resolveCollectionEditorContext(args)
	const drafts = createDraftsFor(resolved)

	// `args.url` is React Router's normalized URL (no `.data` suffix or
	// index/_routes params), so `?draft=` is where the editor put it.
	const draftId = new URL(args.url).searchParams.get("draft")
	const target = getDraftTarget(args.params, draftId)
	const mode = target.mode
	const opened = await drafts.open(target)
	// The only thing `open` can fail to find is what the route asked it for: the
	// Draft named by `?draft=` for a new item, the item itself otherwise.
	if (!opened.ok) throw draftRefusalResponse(opened)

	return {
		canPublish: true,
		draftId: opened.draftId,
		draftRevision: opened.revision,
		initialContent: opened.content,
		initialFields: opened.fields,
		originalFields: opened.source?.frontmatter ?? ({} as FieldRecord),
		owner: resolved.owner,
		name: resolved.name,
		schema: resolved.collection.schema,
		itemSlug: opened.source?.itemSlug ?? null,
		mode,
		publishDisabledReason: null,
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
	const collectionPath = getCollectionPath(
		{ repoName: resolved.name, repoOwnerLogin: resolved.owner },
		resolved.collectionSlug,
	)
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
	const {
		canPublish,
		draftId,
		draftRevision,
		initialContent,
		initialFields,
		mode,
		owner,
		name,
		schema,
		publishDisabledReason,
	} = loaderData
	const location = useLocation()
	const navigate = useNavigate()
	const editorRef = useRef<EditorRefApi>(null)
	const [fields, setFields] = useState<FieldRecord>(initialFields)
	const fieldsRef = useRef(fields)
	const [metadataDirty, setMetadataDirty] = useState(false)
	const [metadataGeneration, setMetadataGeneration] = useState(0)
	const [isPublishing, setIsPublishing] = useState(false)
	const [isPropertiesOpen, setIsPropertiesOpen] = useState(true)
	const isMobile = useIsMobile()
	const [isEditorReady, setIsEditorReady] = useState(false)
	const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
	const revisionRef = useRef(draftRevision)
	// A new item has no Draft until its first save mints one, so the id arrives in
	// a response rather than in the loader's answer. Every mutation reads it at
	// the moment it is sent, so the save behind the minting one carries the id
	// that save minted instead of the null this render was built on.
	const draftIdRef = useRef(draftId)
	const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
	const [autosaveState, setAutosaveState] =
		useState<AutosaveState>(initialAutosaveState)
	const assetBaseUrl = `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
	const { documentKey, sidebarFields, titleKey } = useMemo(
		() => getCollectionEditorFields(schema),
		[schema],
	)
	const titleField = titleKey ? schema[titleKey] : null
	const toggleProperties = useCallback(
		() => setIsPropertiesOpen((open) => !open),
		[],
	)
	useEffect(() => {
		draftIdRef.current = draftId
	}, [draftId])
	// Autosave flushes on unmount, so the save that mints the Draft can answer
	// after the writer has left the editor — at which point the URL is somebody
	// else's, and adopting into it would drag them back here.
	const isMountedRef = useRef(true)
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	/**
	 * Put the Draft the first save minted in the URL, which is how a reload finds
	 * the writer's work again. `shouldRevalidate` declines the loader that would
	 * otherwise follow: this navigation carries no news the editor doesn't have.
	 */
	const adoptDraftId = useCallback(
		async (id: string) => {
			if (!isMountedRef.current) return
			const search = new URLSearchParams(location.search)
			if (search.get("draft") === id) return
			search.set("draft", id)
			await navigate(`${location.pathname}?${search.toString()}`, {
				preventScrollReset: true,
				replace: true,
			})
		},
		[location.pathname, location.search, navigate],
	)
	const registerEditorRef = useCallback((api: EditorRefApi | null) => {
		editorRef.current = api
		setIsEditorReady(api !== null)
		// The ref alone never re-renders on document changes, so the word count
		// needs the Tiptap instance itself in state to subscribe to it.
		setEditorInstance(api?.getEditor() ?? null)
	}, [])

	const sendAction = useCallback(
		(intent: EditorActionIntents, markdown: string) => {
			const fieldsSnapshot = fieldsRef.current
			const operation = mutationQueueRef.current
				.catch(() => undefined)
				.then(async () => {
					const response = await fetch(
						`/api/editor${location.pathname}${location.search}`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								draftId: draftIdRef.current,
								expectedRevision: revisionRef.current,
								intent,
								markdown,
								fields: fieldsSnapshot,
							}),
						},
					)
					const responseText = await response.text()
					let result: {
						draftDeleted?: boolean
						draftId?: string | null
						error?: string
						revision?: number | null
						collectionPath?: string
					} = {}
					try {
						result = JSON.parse(responseText) as typeof result
					} catch {
						result = { error: responseText || undefined }
					}
					if (!response.ok) {
						throw new Error(result.error ?? "Could not save the editor draft")
					}
					if (result.draftDeleted) {
						draftIdRef.current = null
						revisionRef.current = null
					} else if (typeof result.revision === "number") {
						draftIdRef.current = result.draftId ?? draftIdRef.current
						revisionRef.current = result.revision
					}
					if (
						canonicalMetadata(fieldsRef.current) ===
						canonicalMetadata(fieldsSnapshot)
					)
						setMetadataDirty(false)
					// Awaited so the editor stays in its publishing state until the
					// collection page has actually loaded, rather than sitting idle and
					// re-clickable while its loader runs.
					if (intent === EditorActionIntents.PUBLISH && result.collectionPath) {
						await navigate(result.collectionPath, { replace: true })
						return
					}
					if (mode === "new" && draftIdRef.current)
						await adoptDraftId(draftIdRef.current)
				})
			mutationQueueRef.current = operation.catch(() => undefined)
			return operation
		},
		[adoptDraftId, location.pathname, location.search, mode, navigate],
	)

	const updateField = useCallback(
		(key: string, value: unknown) => {
			setFields((current) => {
				const next = updateMetadataField(schema, current, key, value)
				fieldsRef.current = next
				return next
			})
			setMetadataDirty(true)
			setMetadataGeneration((generation) => generation + 1)
		},
		[schema],
	)

	const save = useCallback(async () => {
		if (!editorRef.current) throw new Error("The editor is still loading")
		await editorRef.current.save()
	}, [])

	const publish = useCallback(async () => {
		setIsPublishing(true)
		try {
			await editorRef.current?.publish()
		} finally {
			setIsPublishing(false)
		}
	}, [])

	const persistence = useMemo(
		() => ({
			onAutoSave: (markdown: string) =>
				sendAction(EditorActionIntents.SAVE, markdown),
			onPublish: (markdown: string) =>
				sendAction(EditorActionIntents.PUBLISH, markdown),
		}),
		[sendAction],
	)

	const combinedAutosaveState = useMemo(
		() => ({
			...autosaveState,
			isDirty: autosaveState.isDirty || metadataDirty,
		}),
		[autosaveState, metadataDirty],
	)
	const controls = useMemo(
		() => ({
			autosaveState: combinedAutosaveState,
			canPublish: canPublish && isEditorReady && !isPublishing,
			canSave: isEditorReady && !isPublishing,
			isPropertiesOpen,
			publish,
			publishDisabledReason: publishDisabledReason ?? undefined,
			save,
			toggleProperties,
		}),
		[
			combinedAutosaveState,
			canPublish,
			isEditorReady,
			isPropertiesOpen,
			isPublishing,
			publish,
			publishDisabledReason,
			save,
			toggleProperties,
		],
	)
	useEditorLayoutControls(controls)

	useEffect(() => {
		if (
			metadataGeneration === 0 ||
			!metadataDirty ||
			!editorRef.current ||
			isPublishing
		)
			return
		const timeout = window.setTimeout(() => {
			void editorRef.current?.save().catch((error: unknown) => {
				console.error("Metadata autosave failed:", error)
			})
		}, 1000)
		return () => window.clearTimeout(timeout)
	}, [isPublishing, metadataDirty, metadataGeneration])

	// One open state serves both presentations, so crossing into the mobile
	// breakpoint has to close it: the desktop default is open, and a Sheet that
	// inherited that would cover the editor on load.
	useEffect(() => {
		if (isMobile) setIsPropertiesOpen(false)
	}, [isMobile])

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!metadataDirty && !editorRef.current?.hasUnsavedChanges()) return
			event.preventDefault()
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => window.removeEventListener("beforeunload", handleBeforeUnload)
	}, [metadataDirty])

	const properties = sidebarFields.map(([key, field]) => (
		<MetadataField
			key={key}
			field={field}
			value={fields[key]}
			onChange={(value) => updateField(key, value)}
			disabled={isPublishing}
			assetBaseUrl={assetBaseUrl}
		/>
	))

	return (
		<div className="relative flex h-full min-h-0 overflow-hidden">
			<div className="min-w-0 flex-1 overflow-y-auto">
				<div className="editor-wrapper relative space-y-6 px-6 pt-10 pb-20">
					{titleKey && titleField?.type === "text" ? (
						<div className="pl-12">
							<CollectionTitleField
								value={String(fields[titleKey] ?? "")}
								placeholder={titleField.placeholder}
								disabled={isPublishing}
								onChange={(value) => updateField(titleKey, value)}
								onCommit={() => editorRef.current?.focus("start")}
							/>
						</div>
					) : null}

					<RichTextEditor
						key={documentKey ?? "fallback-content"}
						ref={registerEditorRef}
						initialContent={initialContent}
						onAutosaveStateChange={setAutosaveState}
						persistence={persistence}
						readOnly={isPublishing}
					/>
				</div>
			</div>

			<div className="pointer-events-none absolute bottom-0 left-0 z-10 px-6 py-3">
				<EditorWordCount
					editor={editorInstance}
					className="rounded-md bg-background/80 px-2 py-1 backdrop-blur-sm"
				/>
			</div>

			<aside
				aria-label="Properties"
				className={`hidden shrink-0 overflow-hidden bg-muted/10 transition-[width] duration-200 md:flex ${
					isPropertiesOpen ? "w-80 border-l" : "w-0"
				}`}
			>
				<div className="flex w-80 shrink-0 flex-col">
					<div className="flex flex-col gap-6 overflow-y-auto px-4 py-6">
						{properties}
					</div>
				</div>
			</aside>

			{/* Below `md` the aside is display:none, so the same open state drives
			    this Sheet instead — the header's toggle is the only trigger. */}
			<Sheet
				open={isMobile && isPropertiesOpen}
				onOpenChange={setIsPropertiesOpen}
			>
				<SheetContent className="w-full max-w-sm">
					<SheetHeader>
						<SheetTitle>Properties</SheetTitle>
						<SheetDescription>
							Collection metadata for this item.
						</SheetDescription>
					</SheetHeader>
					<div className="flex flex-col gap-6 overflow-y-auto px-6 pb-6">
						{properties}
					</div>
				</SheetContent>
			</Sheet>
		</div>
	)
}
