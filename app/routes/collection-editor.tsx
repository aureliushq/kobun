import { and, eq } from "drizzle-orm"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { redirect, useLocation, useNavigate } from "react-router"
import invariant from "tiny-invariant"
import { getAuth } from "@/auth/auth.server"
import { fetchAndParseConfig } from "@/config/github.server"
import { useEditorLayoutControls } from "@/core/components/layouts/editor-context"
import { envContext } from "@/core/context"
import {
	canonicalMetadata,
	type FieldRecord,
	getCollectionEditorFields,
	updateMetadataField,
} from "@/core/editor/collection-metadata"
import { MetadataField } from "@/core/editor/collection-metadata-fields"
import {
	type DraftRefusal,
	type DraftTarget,
	getCollectionItemEditorPath,
	type SaveInput,
} from "@/core/editor/drafts"
import { createDrafts } from "@/core/editor/drafts/create-drafts"
import { createGithubSourceStore } from "@/core/editor/drafts/github-source-store.server"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema/app-schema"
import { type AutosaveState, type EditorRefApi, RichTextEditor } from "@/editor"
import { Button } from "@/ui/components/base/button"
import { Input } from "@/ui/components/base/input"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/ui/components/base/sheet"
import { PATHS } from "@/ui/lib/constants"
import { EditorActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/collection-editor"

const initialAutosaveState: AutosaveState = {
	isDirty: false,
	isSaving: false,
	lastSavedAt: null,
}

async function resolveCollectionContext({
	context,
	params,
	request,
}: Route.LoaderArgs | Route.ActionArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)
	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const { owner, name, collection_slug } = params
	invariant(
		owner && name && collection_slug,
		"collection route params are required",
	)

	const projectRow = await db.query.project.findFirst({
		where: and(
			eq(project.userId, session.user.id),
			eq(project.repoOwnerLogin, owner),
			eq(project.repoName, name),
		),
		with: { githubInstallation: true },
	})
	if (!projectRow) throw new Response("Not Found", { status: 404 })

	const installationId = projectRow.githubInstallation.githubInstallationId
	const configResult = await fetchAndParseConfig(
		env,
		installationId,
		owner,
		name,
	)
	const config = configResult.config
	if (!config)
		throw new Response("Invalid repository configuration", { status: 422 })
	const collection = config.collections[collection_slug]
	if (!collection) throw new Response("Collection not found", { status: 404 })
	if (collection.format !== "md" && collection.format !== "mdx") {
		throw new Response("Rich text editing requires an md or mdx collection", {
			status: 422,
		})
	}

	return {
		collection,
		collectionSlug: collection_slug,
		db,
		directoryPath: `${config.basePath}/${collection_slug}`.replace(/\/+/g, "/"),
		env,
		installationId,
		name,
		owner,
		projectRow,
		sourceStore: createGithubSourceStore({ env, installationId, name, owner }),
	}
}

function createDraftsFor(
	resolved: Awaited<ReturnType<typeof resolveCollectionContext>>,
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

export async function loader(args: Route.LoaderArgs) {
	const resolved = await resolveCollectionContext(args)
	const drafts = createDraftsFor(resolved)

	// `args.url` is React Router's normalized URL (no `.data` suffix or
	// index/_routes params); clone it so we can mutate searchParams safely.
	const url = new URL(args.url)
	const target = getDraftTarget(args.params, url.searchParams.get("draft"))
	const mode = target.mode
	const opened = await drafts.open(target)
	// The only thing `open` can fail to find is what the route asked it for: the
	// Draft named by `?draft=` for a new item, the item itself otherwise.
	if (!opened.ok) throw draftRefusalResponse(opened)
	if (opened.created) {
		url.searchParams.set("draft", opened.draftId)
		throw redirect(`${url.pathname}${url.search}`)
	}

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
	const resolved = await resolveCollectionContext(args)
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
		if (saved.outcome === "matches-source") {
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

	const editorPath = getCollectionItemEditorPath(
		{ repoName: resolved.name, repoOwnerLogin: resolved.owner },
		resolved.collectionSlug,
		published.itemSlug,
	)
	if (published.outcome === "matches-source") {
		return Response.json({
			ok: true,
			commitSha: null,
			draftDeleted: true,
			draftId: published.draftId,
			editorPath,
		})
	}
	if (published.outcome === "published-unsynced") {
		return Response.json({
			ok: true,
			commitSha: published.commitSha,
			draftId: published.draftId,
			draftSynced: false,
			editorPath,
		})
	}
	return Response.json({
		ok: true,
		commitSha: published.commitSha,
		draftDeleted: published.draftDeleted,
		draftId: published.draftId,
		revision: published.revision,
		editorPath,
	})
}

export default function CollectionEditor({ loaderData }: Route.ComponentProps) {
	const {
		canPublish,
		draftId,
		draftRevision,
		initialContent,
		initialFields,
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
	const [isEditorReady, setIsEditorReady] = useState(false)
	const revisionRef = useRef(draftRevision)
	const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
	const [autosaveState, setAutosaveState] =
		useState<AutosaveState>(initialAutosaveState)
	const assetBaseUrl = `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
	const { documentKey, sidebarFields, titleKey } = useMemo(
		() => getCollectionEditorFields(schema),
		[schema],
	)
	const titleField = titleKey ? schema[titleKey] : null
	const registerEditorRef = useCallback((api: EditorRefApi | null) => {
		editorRef.current = api
		setIsEditorReady(api !== null)
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
								draftId,
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
						error?: string
						revision?: number | null
						editorPath?: string
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
						revisionRef.current = null
					} else if (typeof result.revision === "number") {
						revisionRef.current = result.revision
					}
					if (
						canonicalMetadata(fieldsRef.current) ===
						canonicalMetadata(fieldsSnapshot)
					)
						setMetadataDirty(false)
					if (intent === EditorActionIntents.PUBLISH && result.editorPath)
						navigate(result.editorPath, { replace: true })
				})
			mutationQueueRef.current = operation.catch(() => undefined)
			return operation
		},
		[draftId, location.pathname, location.search, navigate],
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
			publish,
			publishDisabledReason: publishDisabledReason ?? undefined,
			save,
		}),
		[
			combinedAutosaveState,
			canPublish,
			isEditorReady,
			isPublishing,
			publish,
			publishDisabledReason,
			save,
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
				<div className="editor-wrapper relative space-y-6 px-6 py-10">
					<div className="absolute top-4 right-4 flex gap-2">
						{!isPropertiesOpen ? (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="hidden md:inline-flex"
								onClick={() => setIsPropertiesOpen(true)}
								aria-label="Open properties"
							>
								<PanelRightOpen />
							</Button>
						) : null}
						<Sheet>
							<SheetTrigger
								render={
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="md:hidden"
										aria-label="Open properties"
									/>
								}
							>
								<PanelRightOpen />
							</SheetTrigger>
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

					{titleKey && titleField?.type === "text" ? (
						<div className="pl-12">
							<Input
								value={String(fields[titleKey] ?? "")}
								placeholder={titleField.placeholder}
								disabled={isPublishing}
								aria-label="Title"
								className="h-auto border-0 bg-transparent px-0 py-2 font-semibold text-4xl shadow-none focus-visible:ring-0 dark:bg-transparent"
								onChange={(event) => updateField(titleKey, event.target.value)}
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

			<aside
				aria-label="Properties"
				className={`hidden shrink-0 overflow-hidden bg-muted/10 transition-[width] duration-200 md:flex ${
					isPropertiesOpen ? "w-80 border-l" : "w-0"
				}`}
			>
				<div className="flex w-80 shrink-0 flex-col">
					<div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
						<h2 className="font-medium text-sm">Properties</h2>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => setIsPropertiesOpen(false)}
							aria-label="Close properties"
						>
							<PanelRightClose />
						</Button>
					</div>
					<div className="flex flex-col gap-6 overflow-y-auto p-4">
						{properties}
					</div>
				</div>
			</aside>
		</div>
	)
}
