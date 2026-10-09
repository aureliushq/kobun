import type { Editor } from "@tiptap/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import type { ResolvedField } from "@/config/types"
import { useEditorLayoutControls } from "@/core/components/layouts/editor-context"
import { canonicalMetadata } from "@/core/content"
import {
	applyMetadataDefaults,
	type FieldRecord,
	getCollectionEditorFields,
	updateMetadataField,
} from "@/core/editor/collection-metadata"
import { MetadataField } from "@/core/editor/collection-metadata-fields"
import { CollectionTitleField } from "@/core/editor/collection-title-field"
import {
	EditorActionError,
	type EditorSaveError,
	readRefusalCode,
	toEditorSaveError,
} from "@/core/editor/editor-action"
import {
	checkStagedImage,
	stagedImageBaseUrl,
} from "@/core/editor/staged-images"
import { previewSrc } from "@/core/fields/image"
import type { MediaLocation } from "@/core/fields/types"
import { usePreferences } from "@/core/preferences/context"
import {
	type AutosaveState,
	type EditorRefApi,
	EditorWordCount,
	type ImageUploadAdapter,
	RichTextEditor,
} from "@/editor"
import { Separator } from "@/ui/components/base/separator"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/ui/components/base/sheet"
import { EditorBodySkeleton } from "@/ui/components/blocks/skeletons"
import { useIsMobile } from "@/ui/hooks/use-mobile"
import { EditorActionIntents } from "@/ui/lib/types"

/** What the editor opens with, as the route's loader hands it over. */
export type OpenedContent = {
	content: string
	draftId: string | null
	fields: FieldRecord
	revision: number | null
	/** Whether the Draft holds bytes the Source lacks: **Dirty**. */
	dirty: boolean
}

/** The part of the rich-text editor's ref this component drives. */
type EditorHandle = Pick<
	EditorRefApi,
	"commit" | "focus" | "getEditor" | "hasUnsavedChanges" | "publish" | "save"
>

const initialAutosaveState: AutosaveState = {
	isDirty: false,
	isSaving: false,
	lastSavedAt: null,
}

/**
 * The properties panel's open state.
 *
 * It lives above the streaming boundary, in the route, because the toggle sits
 * in the layout's header and works from the first paint: a writer who closes the
 * panel while the content streams must not have it reopen under them when the
 * content lands and React remounts everything inside the boundary.
 */
export function usePropertiesPanel() {
	// Where it starts, not where it stays: the Preference is read once here and
	// the writer's toggling is this session's, which is what "an item opens with
	// its properties showing" claims and all it claims.
	const { propertiesPanelOpen } = usePreferences()
	const [isOpen, setIsOpen] = useState(propertiesPanelOpen)
	const isMobile = useIsMobile()
	const toggle = useCallback(() => setIsOpen((open) => !open), [])

	// One open state serves both presentations, so crossing into the mobile
	// breakpoint has to close it: the desktop default is open, and a Sheet that
	// inherited that would cover the editor on load.
	useEffect(() => {
		if (isMobile) setIsOpen(false)
	}, [isMobile])

	return { isMobile, isOpen, setIsOpen, toggle }
}

export type PropertiesPanel = ReturnType<typeof usePropertiesPanel>

/**
 * One Collection Item's editor, or one Singleton's.
 *
 * `opened` is `null` while the Effective Content is still streaming — one state
 * rather than a document plus a flag, so "loading, with content" cannot be
 * expressed. The same component renders both halves of the `Suspense` in
 * `routes/collection-editor`, which is what keeps the placeholder's geometry
 * matching the real writing column's by construction.
 *
 * The Body is the one place the two halves differ in kind rather than in a prop:
 * `RichTextEditor` reads `initialContent` once at mount and can never be
 * re-seeded, so the pending half mounts no editor at all and lets the boundary's
 * fallback-to-child swap do the seeding. That is also what makes the placeholder
 * unwritable and unable to autosave — there is nothing there to type into.
 */
export function CollectionItemEditor({
	canPublish,
	editorPath,
	hasBody,
	media,
	mode,
	name,
	opened,
	owner,
	panel,
	publishDisabledReason,
	schema,
}: {
	canPublish: boolean
	/**
	 * Where a Singleton's array rows open in their own editors. A Collection
	 * Item's rows have no editor of their own, so its editor passes none.
	 */
	editorPath?: string
	/**
	 * Whether the Format has a Body. A data-only one has nothing for a rich-text
	 * editor to hold, so its Fields take the writing column instead.
	 */
	hasBody: boolean
	/** Where committed images are, for the Body and image Fields to preview. */
	media: MediaLocation
	mode: "item" | "new"
	name: string
	opened: OpenedContent | null
	owner: string
	panel: PropertiesPanel
	publishDisabledReason: string | null
	schema: Record<string, ResolvedField>
}) {
	const pending = opened === null
	const location = useLocation()
	const navigate = useNavigate()
	const editorRef = useRef<EditorHandle>(null)
	// Pending renders from the schema alone, on the same defaults a brand-new
	// item opens on: every control then has a real, well-formed, empty state to
	// be disabled in rather than a value its Field Type never expects.
	const [fields, setFields] = useState<FieldRecord>(
		() => opened?.fields ?? applyMetadataDefaults(schema, {}),
	)
	const fieldsRef = useRef(fields)
	const [metadataDirty, setMetadataDirty] = useState(false)
	const [metadataGeneration, setMetadataGeneration] = useState(0)
	// Either commit holds the editor: the Draft is deleted underneath it, so
	// nothing may be typed into a document whose Source is mid-flight.
	const [isCommitting, setIsCommitting] = useState(false)
	const { isMobile, isOpen: isPropertiesOpen, setIsOpen, toggle } = panel
	const preferences = usePreferences()
	const [isEditorReady, setIsEditorReady] = useState(false)
	const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
	const revisionRef = useRef(opened?.revision ?? null)
	// A new item has no Draft until its first save mints one, so the id arrives in
	// a response rather than in the loader's answer. Every mutation reads it at
	// the moment it is sent, so the save behind the minting one carries the id
	// that save minted instead of the null this render was built on.
	const draftIdRef = useRef(opened?.draftId ?? null)
	// The Fields as the server last held them, sent with every mutation. A row
	// of a Singleton is addressed by its position, which the Revision cannot vouch
	// for once another session has committed and its Draft is gone; the row
	// editor checks this against the row that position holds now.
	const savedFieldsRef = useRef(opened?.fields ?? null)
	// Whether the repository is behind — the Draft holds bytes the Source does
	// not. Seeded from what `open` decided, then moved by the answers to the
	// mutations this component already sends. The header warns a departing
	// writer on it when Save to GitHub is their primary (ADR-0008).
	const [hasUncommittedWork, setHasUncommittedWork] = useState(
		opened?.dirty ?? false,
	)
	// Why the last mutation failed. An autosave's refusal has nobody to throw to
	// but a console, so the header reads it from here (#159).
	const [saveError, setSaveError] = useState<EditorSaveError | null>(null)
	// Set by a Revision Conflict. Every request after one carries the same stale
	// Revision, so none can go through: the editor holds rather than keep the
	// writer typing into work it cannot keep, and a reload is the way on (#166).
	const conflictRef = useRef<EditorActionError | null>(null)
	const [isConflicted, setIsConflicted] = useState(false)
	const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve())
	const [autosaveState, setAutosaveState] =
		useState<AutosaveState>(initialAutosaveState)
	const assetBaseUrl = `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
	// An image added to the Body is staged as it lands, and the Draft keeps only
	// the URL it is served from. The node shows whatever this throws (#177).
	// Once committed it is linked by its repository path, shown through the
	// asset route like an image Field's.
	const imageUpload = useMemo<ImageUploadAdapter>(
		() => ({
			resolveSrc: (src) => previewSrc(src, assetBaseUrl, media),
			upload: async (file) => {
				const body = new FormData()
				body.set("file", file)
				const response = await fetch(stagedImageBaseUrl(owner, name), {
					body,
					method: "POST",
				}).catch(() => {
					throw new Error("Could not upload the image")
				})
				const result = (await response.json().catch(() => ({}))) as {
					error?: string
					src?: string
				}
				if (!response.ok || !result.src) {
					throw new Error(result.error ?? "Could not upload the image")
				}
				return result.src
			},
			validate: (file) => checkStagedImage(file)?.error ?? null,
		}),
		[assetBaseUrl, media, name, owner],
	)
	const { documentKey, managedFields, sidebarFields, titleKey } = useMemo(
		() => getCollectionEditorFields(schema),
		[schema],
	)
	const titleField = titleKey ? schema[titleKey] : null
	const draftId = opened?.draftId ?? null
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
	// What every mutation addresses, read when it is sent rather than when it was
	// queued. An autosave queued behind the first Save to GitHub on a new item is
	// sent after the commit has made it an item, and must go there (#176).
	const targetRef = useRef({
		mode,
		path: `${location.pathname}${location.search}`,
	})
	useEffect(() => {
		targetRef.current = {
			mode,
			path: `${location.pathname}${location.search}`,
		}
	}, [location.pathname, location.search, mode])

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
	const registerEditorRef = useCallback((api: EditorHandle | null) => {
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
					// Refused here rather than sent to be refused again.
					if (conflictRef.current) throw conflictRef.current
					setSaveError(null)
					const { response, responseText } = await fetch(
						`/api/editor${targetRef.current.path}`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								baseFields: savedFieldsRef.current,
								draftId: draftIdRef.current,
								expectedRevision: revisionRef.current,
								intent,
								markdown,
								fields: fieldsSnapshot,
							}),
						},
					)
						.then(async (response) => ({
							response,
							responseText: await response.text(),
						}))
						.catch(() => {
							// Each browser words a dropped request its own way — before
							// the answer or partway through it — and none of them tells
							// the writer what happened to their work.
							throw new EditorActionError("Could not reach the server")
						})
					let result: {
						code?: unknown
						draftDeleted?: boolean
						draftId?: string | null
						error?: string
						fields?: FieldRecord | null
						images?: Record<string, string>
						itemPath?: string
						revision?: number | null
						collectionPath?: string
					} = {}
					// The action refuses with a 4xx. A 5xx on a commit is the
					// platform's — a Worker over its CPU limit, say — and whatever
					// it says, the writer can only retry or keep a Draft (#174).
					const isServerFailure =
						response.status >= 500 && intent !== EditorActionIntents.SAVE
					try {
						result = JSON.parse(responseText) as typeof result
					} catch {
						// A plain-text refusal is written to be read. An error page —
						// a proxy's, say — is markup for a browser tab, and would fill
						// the status line with it.
						const isErrorPage = response.headers
							.get("Content-Type")
							?.includes("text/html")
						result = {
							error: isErrorPage ? undefined : responseText || undefined,
						}
					}
					if (!response.ok) {
						throw new EditorActionError(
							isServerFailure
								? "GitHub save failed — try again later, or use Save."
								: (result.error ?? "Could not save the editor draft"),
							readRefusalCode(result.code),
						)
					}
					savedFieldsRef.current = result.fields ?? fieldsSnapshot
					if (result.draftDeleted) {
						draftIdRef.current = null
						revisionRef.current = null
					} else if (typeof result.revision === "number") {
						draftIdRef.current = result.draftId ?? draftIdRef.current
						revisionRef.current = result.revision
					}
					// Only a save leaves the repository behind. A Commit reached it
					// even where the guarded sync could not claim the Draft — the
					// bytes are there either way.
					setHasUncommittedWork(
						intent === EditorActionIntents.SAVE && !result.draftDeleted,
					)
					if (
						canonicalMetadata(fieldsRef.current) ===
						canonicalMetadata(fieldsSnapshot)
					)
						setMetadataDirty(false)
					// What the commit actually wrote, stamps included. A Save to GitHub
					// leaves the writer here with the Draft already deleted, so fields
					// still holding pre-stamp values would read as Dirty against the
					// Source the commit just created.
					if (
						result.fields &&
						canonicalMetadata(fieldsRef.current) ===
							canonicalMetadata(fieldsSnapshot)
					) {
						fieldsRef.current = result.fields
						setFields(result.fields)
					}
					// Where a commit moved each Staged Image, for the Body to follow:
					// the staged copies are gone once the repository holds them.
					const moved = { imageSources: result.images ?? {} }
					// Awaited so the editor stays in its committing state until the
					// collection page has actually loaded, rather than sitting idle and
					// re-clickable while its loader runs.
					if (intent === EditorActionIntents.PUBLISH && result.collectionPath) {
						await navigate(result.collectionPath, { replace: true })
						return
					}
					// A Save to GitHub turned this new item into one the repository
					// names. The URL has to follow, or the next keystroke mints a
					// second Draft with no Source and the commit after it is refused
					// as a duplicate slug. The loader is skipped, as for a Draft's
					// adoption: the editor already holds what was committed, and
					// re-running it would remount the editor over a read from GitHub
					// (#176). An existing item whose Slug changed is the opposite case:
					// the route keys its editor on the Slug, so it remounts anyway, and
					// must remount on what was just committed.
					if (result.itemPath) {
						const isNew = targetRef.current.mode === "new"
						targetRef.current = { mode: "item", path: result.itemPath }
						await navigate(result.itemPath, {
							defaultShouldRevalidate: !isNew,
							preventScrollReset: true,
							replace: true,
						})
						return moved
					}
					if (targetRef.current.mode === "new" && draftIdRef.current)
						await adoptDraftId(draftIdRef.current)
					return moved
				})
				.catch((error: unknown) => {
					if (
						error instanceof EditorActionError &&
						error.code === "revision-conflict"
					) {
						conflictRef.current = error
						setIsConflicted(true)
					}
					setSaveError(
						toEditorSaveError(error, "Could not save the editor draft"),
					)
					throw error
				})
			mutationQueueRef.current = operation.catch(() => undefined)
			return operation
		},
		[adoptDraftId, navigate],
	)

	// A data-only Format mounts no rich-text editor to carry saves, so this
	// stands where its ref would and sends an empty Body. The metadata autosave,
	// the header's actions and their gates then run exactly as they do over one.
	const bodilessEditor = useMemo<EditorHandle>(
		() => ({
			commit: async () => {
				await sendAction(EditorActionIntents.COMMIT, "")
			},
			focus: () => undefined,
			getEditor: () => null,
			hasUnsavedChanges: () => false,
			publish: async () => {
				await sendAction(EditorActionIntents.PUBLISH, "")
			},
			save: async () => {
				setAutosaveState((state) => ({ ...state, isSaving: true }))
				try {
					await sendAction(EditorActionIntents.SAVE, "")
					setAutosaveState({
						isDirty: false,
						isSaving: false,
						lastSavedAt: new Date(),
					})
				} catch (error) {
					setAutosaveState((state) => ({ ...state, isSaving: false }))
					throw error
				}
			},
		}),
		[sendAction],
	)
	useEffect(() => {
		if (hasBody || pending) return
		registerEditorRef(bodilessEditor)
		return () => registerEditorRef(null)
	}, [bodilessEditor, hasBody, pending, registerEditorRef])

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

	const commit = useCallback(async () => {
		setIsCommitting(true)
		try {
			await editorRef.current?.commit()
		} finally {
			setIsCommitting(false)
		}
	}, [])

	const publish = useCallback(async () => {
		setIsCommitting(true)
		try {
			await editorRef.current?.publish()
		} finally {
			setIsCommitting(false)
		}
	}, [])

	const persistence = useMemo(
		() => ({
			onAutoSave: async (markdown: string) => {
				await sendAction(EditorActionIntents.SAVE, markdown)
			},
			// The one answer the editor reads: where the commit moved images.
			onCommit: (markdown: string) =>
				sendAction(EditorActionIntents.COMMIT, markdown),
			onPublish: async (markdown: string) => {
				await sendAction(EditorActionIntents.PUBLISH, markdown)
			},
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
	// A commit holds the editor while it runs; a Revision Conflict holds it for
	// good, since nothing typed after one can be kept.
	const isHeld = isCommitting || isConflicted
	// `!pending` is what `isEditorReady` already implies — no editor is mounted
	// over a placeholder — but neither Save nor Publish may act on a half-loaded
	// Draft, and that is a property this route states rather than inherits.
	const controls = useMemo(
		() => ({
			autosaveState: combinedAutosaveState,
			canCommit: !pending && isEditorReady && !isHeld,
			canPublish: canPublish && !pending && isEditorReady && !isHeld,
			canSave: !pending && isEditorReady && !isHeld,
			commit,
			// Errs toward warning: a Draft the Source lacks, or keystrokes autosave
			// has not persisted yet. A false warning costs a dialogue; a missed one
			// costs the writer their bearings about what GitHub actually holds.
			hasUncommittedWork: hasUncommittedWork || combinedAutosaveState.isDirty,
			// A data-only Format shows its properties in the writing column, so
			// there is no panel for the header to toggle.
			isPropertiesOpen: hasBody ? isPropertiesOpen : undefined,
			// Absent rather than disabled where the Collection has no `publish`
			// Feature: the header renders no button at all (ADR-0008).
			publish: canPublish ? publish : undefined,
			publishDisabledReason: publishDisabledReason ?? undefined,
			save,
			saveError,
			toggleProperties: hasBody ? toggle : undefined,
		}),
		[
			combinedAutosaveState,
			canPublish,
			commit,
			hasBody,
			hasUncommittedWork,
			isEditorReady,
			isHeld,
			isPropertiesOpen,
			pending,
			publish,
			publishDisabledReason,
			save,
			saveError,
			toggle,
		],
	)
	useEditorLayoutControls(controls)

	useEffect(() => {
		if (
			pending ||
			metadataGeneration === 0 ||
			!metadataDirty ||
			!editorRef.current ||
			isHeld
		)
			return
		const timeout = window.setTimeout(() => {
			void editorRef.current?.save().catch((error: unknown) => {
				console.error("Metadata autosave failed:", error)
			})
		}, 1000)
		return () => window.clearTimeout(timeout)
	}, [isHeld, metadataDirty, metadataGeneration, pending])

	// Only about bytes D1 does not have yet. Whether the *repository* is behind
	// is a question about the target the writer chose, and this component
	// deliberately does not know which that is — the layout owns that guard.
	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!metadataDirty && !editorRef.current?.hasUnsavedChanges()) return
			event.preventDefault()
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => window.removeEventListener("beforeunload", handleBeforeUnload)
	}, [metadataDirty])

	const renderProperty = ([key, field]: [string, ResolvedField]) => (
		<MetadataField
			key={key}
			editorPath={editorPath}
			field={field}
			fieldKey={key}
			value={fields[key]}
			onChange={(value) => updateField(key, value)}
			disabled={pending || isHeld}
			assetBaseUrl={assetBaseUrl}
			media={media}
		/>
	)

	// Managed Fields are editable like any other, but they are facts about the
	// item rather than things the writer set out to write, so they sit last,
	// below a divider. A Collection with no Features has neither.
	const properties = (
		<>
			{sidebarFields.map(renderProperty)}
			{managedFields.length > 0 ? (
				<>
					<Separator />
					{managedFields.map(renderProperty)}
				</>
			) : null}
		</>
	)

	return (
		<div className="relative flex h-full min-h-0 overflow-hidden">
			<div className="min-w-0 flex-1 overflow-y-auto">
				<div
					className="editor-wrapper relative space-y-6 px-6 pt-10 pb-20"
					data-editor-font={preferences.editorFont}
					data-editor-width={preferences.editorWidth}
				>
					{titleKey && titleField?.type === "text" ? (
						// The same gutter the editor below reserves for its drag
						// handle, so the Title sits on the writing column's left
						// edge rather than 3rem out from it. The two must match.
						<div className="pl-12">
							<CollectionTitleField
								value={String(fields[titleKey] ?? "")}
								placeholder={titleField.placeholder}
								disabled={pending || isHeld}
								onChange={(value) => updateField(titleKey, value)}
								onCommit={() => editorRef.current?.focus("start")}
							/>
						</div>
					) : null}

					{!hasBody ? (
						// No Body to write, so the Fields are the page: they sit on the
						// Title's edge, where the editor's text would have started.
						<div className="flex flex-col gap-6 pl-12">{properties}</div>
					) : opened === null ? (
						<EditorBodySkeleton />
					) : (
						<RichTextEditor
							key={documentKey ?? "fallback-content"}
							ref={registerEditorRef}
							imageUpload={imageUpload}
							initialContent={opened.content}
							onAutosaveStateChange={setAutosaveState}
							persistence={persistence}
							readOnly={isHeld}
						/>
					)}
				</div>
			</div>

			{hasBody && preferences.wordCountVisible ? (
				<div className="pointer-events-none absolute bottom-0 left-0 z-10 px-6 py-3">
					<EditorWordCount
						editor={editorInstance}
						className="rounded-md bg-background/80 px-2 py-1 backdrop-blur-sm"
					/>
				</div>
			) : null}

			{hasBody ? (
				<>
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
					<Sheet open={isMobile && isPropertiesOpen} onOpenChange={setIsOpen}>
						<SheetContent className="w-full max-w-sm">
							<SheetHeader>
								<SheetTitle>Properties</SheetTitle>
								<SheetDescription>Metadata for this item.</SheetDescription>
							</SheetHeader>
							<div className="flex flex-col gap-6 overflow-y-auto px-6 pb-6">
								{properties}
							</div>
						</SheetContent>
					</Sheet>
				</>
			) : null}
		</div>
	)
}
