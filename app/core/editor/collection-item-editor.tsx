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
import { usePreferences } from "@/core/preferences/context"
import {
	type AutosaveState,
	type EditorRefApi,
	EditorWordCount,
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
 * One Collection Item's editor.
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
	mode,
	name,
	opened,
	owner,
	panel,
	publishDisabledReason,
	schema,
}: {
	canPublish: boolean
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
	const editorRef = useRef<EditorRefApi>(null)
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
	// Whether the repository is behind — the Draft holds bytes the Source does
	// not. Seeded from what `open` decided, then moved by the answers to the
	// mutations this component already sends. The header warns a departing
	// writer on it when Save to GitHub is their primary (ADR-0008).
	const [hasUncommittedWork, setHasUncommittedWork] = useState(
		opened?.dirty ?? false,
	)
	const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
	const [autosaveState, setAutosaveState] =
		useState<AutosaveState>(initialAutosaveState)
	const assetBaseUrl = `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
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
						fields?: FieldRecord | null
						itemPath?: string
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
					// as a duplicate slug.
					if (result.itemPath) {
						await navigate(result.itemPath, { replace: true })
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
			onAutoSave: (markdown: string) =>
				sendAction(EditorActionIntents.SAVE, markdown),
			onCommit: (markdown: string) =>
				sendAction(EditorActionIntents.COMMIT, markdown),
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
	// `!pending` is what `isEditorReady` already implies — no editor is mounted
	// over a placeholder — but neither Save nor Publish may act on a half-loaded
	// Draft, and that is a property this route states rather than inherits.
	const controls = useMemo(
		() => ({
			autosaveState: combinedAutosaveState,
			canCommit: !pending && isEditorReady && !isCommitting,
			canPublish: canPublish && !pending && isEditorReady && !isCommitting,
			canSave: !pending && isEditorReady && !isCommitting,
			commit,
			// Errs toward warning: a Draft the Source lacks, or keystrokes autosave
			// has not persisted yet. A false warning costs a dialogue; a missed one
			// costs the writer their bearings about what GitHub actually holds.
			hasUncommittedWork: hasUncommittedWork || combinedAutosaveState.isDirty,
			isPropertiesOpen,
			// Absent rather than disabled where the Collection has no `publish`
			// Feature: the header renders no button at all (ADR-0008).
			publish: canPublish ? publish : undefined,
			publishDisabledReason: publishDisabledReason ?? undefined,
			save,
			toggleProperties: toggle,
		}),
		[
			combinedAutosaveState,
			canPublish,
			commit,
			hasUncommittedWork,
			isEditorReady,
			isPropertiesOpen,
			isCommitting,
			pending,
			publish,
			publishDisabledReason,
			save,
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
			isCommitting
		)
			return
		const timeout = window.setTimeout(() => {
			void editorRef.current?.save().catch((error: unknown) => {
				console.error("Metadata autosave failed:", error)
			})
		}, 1000)
		return () => window.clearTimeout(timeout)
	}, [isCommitting, metadataDirty, metadataGeneration, pending])

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
			field={field}
			value={fields[key]}
			onChange={(value) => updateField(key, value)}
			disabled={pending || isCommitting}
			assetBaseUrl={assetBaseUrl}
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
								disabled={pending || isCommitting}
								onChange={(value) => updateField(titleKey, value)}
								onCommit={() => editorRef.current?.focus("start")}
							/>
						</div>
					) : null}

					{opened === null ? (
						<EditorBodySkeleton />
					) : (
						<RichTextEditor
							key={documentKey ?? "fallback-content"}
							ref={registerEditorRef}
							initialContent={opened.content}
							onAutosaveStateChange={setAutosaveState}
							persistence={persistence}
							readOnly={isCommitting}
						/>
					)}
				</div>
			</div>

			{preferences.wordCountVisible ? (
				<div className="pointer-events-none absolute bottom-0 left-0 z-10 px-6 py-3">
					<EditorWordCount
						editor={editorInstance}
						className="rounded-md bg-background/80 px-2 py-1 backdrop-blur-sm"
					/>
				</div>
			) : null}

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
