import { and, eq, isNull, sql } from "drizzle-orm"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { redirect, useLocation, useNavigate } from "react-router"
import invariant from "tiny-invariant"
import { getAuth } from "@/auth/auth.server"
import { fetchAndParseConfig } from "@/config/github.server"
import { useEditorLayoutControls } from "@/core/components/layouts/editor-context"
import { envContext } from "@/core/context"
import {
	collectionItemBodyMatches,
	findCollectionItemBySlug,
	isMarkdownCollectionFile,
	serializeCollectionItem,
} from "@/core/editor/collection-items.server"
import {
	applyMetadataDefaults,
	canonicalMetadata,
	type FieldRecord,
	getCollectionEditorFields,
	getSlugField,
	updateMetadataField,
	validateMetadata,
} from "@/core/editor/collection-metadata"
import { MetadataField } from "@/core/editor/collection-metadata-fields"
import { isDraftDirty } from "@/core/editor/drafts"
import { dbContext } from "@/db/context"
import { editorDraft, project } from "@/db/schema/app-schema"
import { type AutosaveState, type EditorRefApi, RichTextEditor } from "@/editor"
import {
	createOrUpdateGithubTextFile,
	listGithubDirectoryFiles,
} from "@/github/octokit.server"
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
	}
}

async function resolveExistingItem(
	resolved: Awaited<ReturnType<typeof resolveCollectionContext>>,
	slug: string,
) {
	const files = await listCollectionFiles(resolved)
	const item = findCollectionItemBySlug(
		resolved.collection,
		files.filter(isMarkdownCollectionFile),
		slug,
	)
	if (!item) throw new Response("Collection item not found", { status: 404 })
	return item
}

async function listCollectionFiles(
	resolved: Awaited<ReturnType<typeof resolveCollectionContext>>,
) {
	let files: Awaited<ReturnType<typeof listGithubDirectoryFiles>> = []
	try {
		files = await listGithubDirectoryFiles(
			resolved.env,
			resolved.installationId,
			resolved.owner,
			resolved.name,
			resolved.directoryPath,
		)
	} catch (error) {
		if (
			!(error instanceof Error && "status" in error && error.status === 404)
		) {
			throw error
		}
	}
	return files
}

function getEditorMode(params: Route.LoaderArgs["params"]) {
	if (params.editor_mode === "new") return "new" as const
	if (params.editor_mode === "item" && params.collection_item_slug) {
		return "item" as const
	}
	throw new Response("Not Found", { status: 404 })
}

export async function loader(args: Route.LoaderArgs) {
	const resolved = await resolveCollectionContext(args)
	const mode = getEditorMode(args.params)

	if (mode === "new") {
		// `args.url` is React Router's normalized URL (no `.data` suffix or
		// index/_routes params); clone it so we can mutate searchParams safely.
		const url = new URL(args.url)
		const draftId = url.searchParams.get("draft")
		if (!draftId) {
			const id = crypto.randomUUID()
			const metadata = applyMetadataDefaults(resolved.collection.schema, {})
			await resolved.db.insert(editorDraft).values({
				id,
				projectId: resolved.projectRow.id,
				collectionSlug: resolved.collectionSlug,
				markdown: "",
				metadata: JSON.stringify(metadata),
				revision: 0,
			})
			url.searchParams.set("draft", id)
			throw redirect(`${url.pathname}${url.search}`)
		}

		const draft = await resolved.db.query.editorDraft.findFirst({
			where: and(
				eq(editorDraft.id, draftId),
				eq(editorDraft.projectId, resolved.projectRow.id),
				eq(editorDraft.collectionSlug, resolved.collectionSlug),
				isNull(editorDraft.sourcePath),
			),
		})
		if (!draft) throw new Response("Draft not found", { status: 404 })

		return {
			canPublish: true,
			draftId: draft.id,
			draftRevision: draft.revision,
			initialContent: draft.markdown,
			initialFields: draft.metadata
				? (JSON.parse(draft.metadata) as FieldRecord)
				: applyMetadataDefaults(resolved.collection.schema, {}),
			originalFields: {} as FieldRecord,
			owner: resolved.owner,
			name: resolved.name,
			schema: resolved.collection.schema,
			itemSlug: null,
			mode,
			publishDisabledReason: null,
		}
	}

	const slug = args.params.collection_item_slug
	invariant(slug, "collection_item_slug is required")
	const item = await resolveExistingItem(resolved, slug)
	let draft = await resolved.db.query.editorDraft.findFirst({
		where: and(
			eq(editorDraft.projectId, resolved.projectRow.id),
			eq(editorDraft.sourcePath, item.path),
		),
	})
	if (draft && !isDraftDirty(draft) && draft.sourceSha !== item.sha) {
		invariant(
			draft.publishedRevision !== null,
			"A synchronized draft must have a published revision",
		)
		const nextRevision = draft.revision + 1
		const [rebased] = await resolved.db
			.update(editorDraft)
			.set({
				markdown: item.body,
				metadata: null,
				publishedRevision: nextRevision,
				revision: nextRevision,
				sourceSha: item.sha,
			})
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, resolved.projectRow.id),
					eq(editorDraft.revision, draft.revision),
					eq(editorDraft.publishedRevision, draft.publishedRevision),
				),
			)
			.returning()
		draft =
			rebased ??
			(await resolved.db.query.editorDraft.findFirst({
				where: eq(editorDraft.id, draft.id),
			}))
	}

	return {
		canPublish: true,
		draftId: draft?.id ?? null,
		draftRevision: draft?.revision ?? null,
		initialContent: draft && isDraftDirty(draft) ? draft.markdown : item.body,
		initialFields:
			draft && isDraftDirty(draft) && draft.metadata
				? (JSON.parse(draft.metadata) as FieldRecord)
				: item.frontmatter,
		originalFields: item.frontmatter,
		owner: resolved.owner,
		name: resolved.name,
		schema: resolved.collection.schema,
		itemSlug: item.itemSlug,
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

async function saveDraft(
	resolved: Awaited<ReturnType<typeof resolveCollectionContext>>,
	payload: EditorActionPayload,
	item: Awaited<ReturnType<typeof resolveExistingItem>> | null,
) {
	const existing = item
		? await resolved.db.query.editorDraft.findFirst({
				where: and(
					eq(editorDraft.projectId, resolved.projectRow.id),
					eq(editorDraft.sourcePath, item.path),
				),
			})
		: payload.draftId
			? await resolved.db.query.editorDraft.findFirst({
					where: and(
						eq(editorDraft.id, payload.draftId),
						eq(editorDraft.projectId, resolved.projectRow.id),
						eq(editorDraft.collectionSlug, resolved.collectionSlug),
						isNull(editorDraft.sourcePath),
					),
				})
			: null

	if (!item && !existing) throw new Response("Draft not found", { status: 404 })
	if (existing) {
		if (payload.expectedRevision !== existing.revision) {
			throw new Response("Draft changed in another session", { status: 409 })
		}
		if (
			existing.markdown === payload.markdown &&
			existing.metadata !== null &&
			canonicalMetadata(JSON.parse(existing.metadata)) ===
				canonicalMetadata(payload.fields)
		) {
			return existing
		}
		const [updated] = await resolved.db
			.update(editorDraft)
			.set({
				itemSlug: item?.itemSlug ?? existing.itemSlug,
				markdown: payload.markdown,
				metadata: JSON.stringify(payload.fields),
				revision: sql`${editorDraft.revision} + 1`,
			})
			.where(
				and(
					eq(editorDraft.id, existing.id),
					eq(editorDraft.projectId, resolved.projectRow.id),
					eq(editorDraft.revision, payload.expectedRevision),
				),
			)
			.returning()
		if (!updated) {
			throw new Response("Draft changed in another session", { status: 409 })
		}
		return updated
	}

	invariant(item, "item is required when creating an existing-item draft")
	if (payload.expectedRevision !== null) {
		throw new Response("Draft changed in another session", { status: 409 })
	}
	try {
		const [created] = await resolved.db
			.insert(editorDraft)
			.values({
				id: crypto.randomUUID(),
				projectId: resolved.projectRow.id,
				collectionSlug: resolved.collectionSlug,
				itemSlug: item.itemSlug,
				sourcePath: item.path,
				sourceSha: item.sha,
				markdown: payload.markdown,
				metadata: JSON.stringify(payload.fields),
				revision: 1,
				publishedRevision: 0,
			})
			.returning()
		return created
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.toLowerCase().includes("unique")
		) {
			throw new Response("Draft changed in another session", { status: 409 })
		}
		throw error
	}
}

async function deleteSyncedDraft(
	resolved: Awaited<ReturnType<typeof resolveCollectionContext>>,
	draft: typeof editorDraft.$inferSelect,
) {
	const [deleted] = await resolved.db
		.delete(editorDraft)
		.where(
			and(
				eq(editorDraft.id, draft.id),
				eq(editorDraft.projectId, resolved.projectRow.id),
				eq(editorDraft.revision, draft.revision),
				eq(editorDraft.publishedRevision, draft.revision),
			),
		)
		.returning({ id: editorDraft.id })
	return deleted !== undefined
}

export async function action(args: Route.ActionArgs) {
	const resolved = await resolveCollectionContext(args)
	const mode = getEditorMode(args.params)
	const payload = await readActionPayload(args.request)
	const item =
		mode === "item"
			? await resolveExistingItem(
					resolved,
					args.params.collection_item_slug as string,
				)
			: null

	// Compare against the freshly loaded GitHub body before creating or updating a
	// draft. This is especially important when an existing item has no D1 draft.
	const metadataMatches = item
		? canonicalMetadata(item.frontmatter) === canonicalMetadata(payload.fields)
		: false
	if (
		payload.intent === EditorActionIntents.SAVE &&
		item &&
		collectionItemBodyMatches(item, payload.markdown) &&
		metadataMatches
	) {
		const existing = await resolved.db.query.editorDraft.findFirst({
			where: and(
				eq(editorDraft.projectId, resolved.projectRow.id),
				eq(editorDraft.sourcePath, item.path),
			),
		})
		if (existing && payload.expectedRevision !== existing.revision) {
			throw new Response("Draft changed in another session", { status: 409 })
		}
		if (!existing && payload.expectedRevision !== null) {
			throw new Response("Draft changed in another session", { status: 409 })
		}

		return Response.json({
			ok: true,
			commitSha: null,
			draftId: existing?.id ?? null,
			revision: existing?.revision ?? null,
		})
	}
	const draft = await saveDraft(resolved, payload, item)

	if (payload.intent === EditorActionIntents.SAVE) {
		return Response.json({
			ok: true,
			draftId: draft.id,
			revision: draft.revision,
		})
	}
	const validationErrors = validateMetadata(
		resolved.collection.schema,
		payload.fields,
	)
	if (
		Object.values(resolved.collection.schema).some(
			(field) => field.type === "document" && field.required,
		) &&
		!payload.markdown.trim()
	) {
		validationErrors.push("Document content is required")
	}
	const slugField = getSlugField(resolved.collection.schema)
	const effectiveSlug = slugField
		? String(payload.fields[slugField] ?? "").trim()
		: ""
	if (!effectiveSlug || !/^[a-z0-9][a-z0-9._-]*$/i.test(effectiveSlug))
		validationErrors.push("Slug must be a valid nonempty filename slug")
	if (validationErrors.length)
		return Response.json(
			{ ok: false, error: validationErrors.join("\n") },
			{ status: 422 },
		)
	const files = await listCollectionFiles(resolved)
	const duplicate = files.filter(isMarkdownCollectionFile).some((file) => {
		if (item && file.path === item.path) return false
		return (
			findCollectionItemBySlug(resolved.collection, [file], effectiveSlug) !==
			null
		)
	})
	if (duplicate)
		return Response.json(
			{ ok: false, error: `Another item already uses slug “${effectiveSlug}”` },
			{ status: 409 },
		)
	const publishPath =
		item?.path ??
		`${resolved.directoryPath}/${effectiveSlug}.${resolved.collection.format}`
	if (item && draft.sourceSha && draft.sourceSha !== item.sha) {
		return Response.json(
			{
				ok: false,
				error:
					"This item changed on GitHub. Copy your draft or discard it before reloading.",
			},
			{ status: 409 },
		)
	}
	const editorPath = `/${resolved.owner}/${resolved.name}/collections/${resolved.collectionSlug}/editor/item/${encodeURIComponent(effectiveSlug)}`
	if (
		item &&
		collectionItemBodyMatches(item, payload.markdown) &&
		metadataMatches
	) {
		const [deleted] = await resolved.db
			.delete(editorDraft)
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, resolved.projectRow.id),
					eq(editorDraft.revision, draft.revision),
				),
			)
			.returning({ id: editorDraft.id })
		if (!deleted) {
			return Response.json(
				{ ok: false, error: "Draft changed in another session" },
				{ status: 409 },
			)
		}
		return Response.json({
			ok: true,
			commitSha: null,
			draftDeleted: true,
			draftId: draft.id,
			editorPath,
		})
	}

	let published: Awaited<ReturnType<typeof createOrUpdateGithubTextFile>>
	try {
		published = await createOrUpdateGithubTextFile(
			resolved.env,
			resolved.installationId,
			resolved.owner,
			resolved.name,
			{
				path: publishPath,
				sha: item?.sha,
				message: `${item ? "Update" : "Create"} ${publishPath} with Kobun`,
				content: serializeCollectionItem(
					payload.markdown,
					item?.sourcePrefix ?? "",
					payload.fields,
					item?.frontmatter ?? {},
				),
			},
		)
	} catch (error) {
		if (error instanceof Error && "status" in error && error.status === 409) {
			return Response.json(
				{
					ok: false,
					error:
						"This item changed on GitHub. Copy your draft or discard it before reloading.",
				},
				{ status: 409 },
			)
		}
		throw error
	}

	const [synced] = await resolved.db
		.update(editorDraft)
		.set({
			itemSlug: effectiveSlug,
			publishedAt: new Date(),
			publishedRevision: draft.revision,
			sourcePath: publishPath,
			sourceSha: published.contentSha,
		})
		.where(
			and(
				eq(editorDraft.id, draft.id),
				eq(editorDraft.projectId, resolved.projectRow.id),
				eq(editorDraft.revision, draft.revision),
				draft.sourceSha === null
					? isNull(editorDraft.sourceSha)
					: eq(editorDraft.sourceSha, draft.sourceSha),
				draft.publishedRevision === null
					? isNull(editorDraft.publishedRevision)
					: eq(editorDraft.publishedRevision, draft.publishedRevision),
			),
		)
		.returning()

	if (!synced) {
		await resolved.db
			.update(editorDraft)
			.set({
				itemSlug: effectiveSlug,
				sourcePath: publishPath,
				sourceSha: published.contentSha,
			})
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, resolved.projectRow.id),
					item
						? eq(editorDraft.sourceSha, item.sha)
						: isNull(editorDraft.sourceSha),
				),
			)
		return Response.json({
			ok: true,
			commitSha: published.commitSha,
			draftId: draft.id,
			draftSynced: false,
			editorPath,
		})
	}
	const draftDeleted = await deleteSyncedDraft(resolved, synced)

	return Response.json({
		ok: true,
		commitSha: published.commitSha,
		draftDeleted,
		draftId: draft.id,
		revision: draftDeleted ? null : draft.revision,
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
