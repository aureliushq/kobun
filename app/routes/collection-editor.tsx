import { and, eq, isNull, sql } from "drizzle-orm"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { redirect, useLocation } from "react-router"
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
import { isDraftDirty } from "@/core/editor/drafts"
import { dbContext } from "@/db/context"
import { editorDraft, project } from "@/db/schema/app-schema"
import { type AutosaveState, type EditorRefApi, RichTextEditor } from "@/editor"
import {
	createOrUpdateGithubTextFile,
	listGithubDirectoryFiles,
} from "@/github/octokit.server"
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

	const item = findCollectionItemBySlug(
		resolved.collection,
		files.filter(isMarkdownCollectionFile),
		slug,
	)
	if (!item) throw new Response("Collection item not found", { status: 404 })
	return item
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
		const url = new URL(args.request.url)
		const draftId = url.searchParams.get("draft")
		if (!draftId) {
			const id = crypto.randomUUID()
			await resolved.db.insert(editorDraft).values({
				id,
				projectId: resolved.projectRow.id,
				collectionSlug: resolved.collectionSlug,
				markdown: "",
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
			canPublish: false,
			draftId: draft.id,
			draftRevision: draft.revision,
			initialContent: draft.markdown,
			itemSlug: null,
			mode,
			publishDisabledReason:
				"Add collection metadata before publishing this new item.",
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
}

async function readActionPayload(
	request: Request,
): Promise<EditorActionPayload> {
	const value = (await request.json()) as Partial<EditorActionPayload>
	if (
		(value.intent !== EditorActionIntents.SAVE &&
			value.intent !== EditorActionIntents.PUBLISH) ||
		typeof value.markdown !== "string"
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
		if (existing.markdown === payload.markdown) {
			return existing
		}
		const [updated] = await resolved.db
			.update(editorDraft)
			.set({
				itemSlug: item?.itemSlug ?? existing.itemSlug,
				markdown: payload.markdown,
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

async function markDraftSynced(
	resolved: Awaited<ReturnType<typeof resolveCollectionContext>>,
	draft: typeof editorDraft.$inferSelect,
	item: Awaited<ReturnType<typeof resolveExistingItem>>,
) {
	if (
		draft.revision === draft.publishedRevision &&
		draft.sourceSha === item.sha &&
		draft.publishedAt !== null
	) {
		return draft
	}

	const [synced] = await resolved.db
		.update(editorDraft)
		.set({
			publishedAt: new Date(),
			publishedRevision: draft.revision,
			sourceSha: item.sha,
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
	return synced
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
	if (item && collectionItemBodyMatches(item, payload.markdown)) {
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

		if (payload.intent === EditorActionIntents.PUBLISH && existing) {
			const synced = await markDraftSynced(resolved, existing, item)
			if (!synced) {
				return Response.json(
					{ ok: false, error: "Draft changed in another session" },
					{ status: 409 },
				)
			}
			const draftDeleted = await deleteSyncedDraft(resolved, synced)
			return Response.json({
				ok: true,
				commitSha: null,
				draftDeleted,
				draftId: existing.id,
			})
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
	if (!item) {
		return Response.json(
			{ ok: false, error: "New items require collection metadata to publish." },
			{ status: 422 },
		)
	}
	if (draft.sourceSha && draft.sourceSha !== item.sha) {
		return Response.json(
			{
				ok: false,
				error:
					"This item changed on GitHub. Copy your draft or discard it before reloading.",
			},
			{ status: 409 },
		)
	}

	let published: Awaited<ReturnType<typeof createOrUpdateGithubTextFile>>
	try {
		published = await createOrUpdateGithubTextFile(
			resolved.env,
			resolved.installationId,
			resolved.owner,
			resolved.name,
			{
				path: item.path,
				sha: item.sha,
				message: `Update ${item.path} with Kobun`,
				content: serializeCollectionItem(payload.markdown, item.sourcePrefix),
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
			publishedAt: new Date(),
			publishedRevision: draft.revision,
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
			.set({ sourceSha: published.contentSha })
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, resolved.projectRow.id),
					eq(editorDraft.sourceSha, item.sha),
				),
			)
		return Response.json({
			ok: true,
			commitSha: published.commitSha,
			draftId: draft.id,
			draftSynced: false,
		})
	}
	const draftDeleted = await deleteSyncedDraft(resolved, synced)

	return Response.json({
		ok: true,
		commitSha: published.commitSha,
		draftDeleted,
		draftId: draft.id,
		revision: draftDeleted ? null : draft.revision,
	})
}

export default function CollectionEditor({ loaderData }: Route.ComponentProps) {
	const {
		canPublish,
		draftId,
		draftRevision,
		initialContent,
		itemSlug,
		mode,
		publishDisabledReason,
	} = loaderData
	const location = useLocation()
	const editorRef = useRef<EditorRefApi>(null)
	const [isEditorReady, setIsEditorReady] = useState(false)
	const revisionRef = useRef(draftRevision)
	const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
	const [autosaveState, setAutosaveState] =
		useState<AutosaveState>(initialAutosaveState)
	const registerEditorRef = useCallback((api: EditorRefApi | null) => {
		editorRef.current = api
		setIsEditorReady(api !== null)
	}, [])

	const sendAction = useCallback(
		(intent: EditorActionIntents, markdown: string) => {
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
							}),
						},
					)
					const responseText = await response.text()
					let result: {
						draftDeleted?: boolean
						error?: string
						revision?: number | null
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
				})
			mutationQueueRef.current = operation.catch(() => undefined)
			return operation
		},
		[draftId, location.pathname, location.search],
	)

	const save = useCallback(async () => {
		if (!editorRef.current) throw new Error("The editor is still loading")
		await editorRef.current.save()
	}, [])

	const publish = useCallback(async () => {
		await editorRef.current?.publish()
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

	const controls = useMemo(
		() => ({
			autosaveState,
			canPublish: canPublish && isEditorReady,
			canSave: isEditorReady,
			publish,
			publishDisabledReason: publishDisabledReason ?? undefined,
			save,
		}),
		[
			autosaveState,
			canPublish,
			isEditorReady,
			publish,
			publishDisabledReason,
			save,
		],
	)
	useEditorLayoutControls(controls)

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!editorRef.current?.hasUnsavedChanges()) return
			event.preventDefault()
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => window.removeEventListener("beforeunload", handleBeforeUnload)
	}, [])

	return (
		<div className="editor-wrapper p-6">
			<p className="mb-4 text-muted-foreground text-sm">
				{mode === "new" ? "New item draft" : `Editing “${itemSlug}”`}
			</p>
			<RichTextEditor
				ref={registerEditorRef}
				initialContent={initialContent}
				onAutosaveStateChange={setAutosaveState}
				persistence={persistence}
			/>
		</div>
	)
}
