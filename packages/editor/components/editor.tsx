import { EditorContent } from "@tiptap/react"
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
} from "react"
import { cn } from "@/ui/lib/utils"
import { useAutosave } from "../hooks/use-autosave"
import { useEditor } from "../hooks/use-editor"
import type { AutosaveState, EditorRefApi, RichTextEditorProps } from "../types"
import { EditorBubbleMenu } from "./menus/bubble-menu/bubble-menu"
import { SideMenu } from "./menus/side-menu/side-menu"

export const RichTextEditor = forwardRef<EditorRefApi, RichTextEditorProps>(
	function RichTextEditor(props, ref) {
		const {
			initialContent,
			placeholder,
			imageUpload,
			onChange,
			readOnly = false,
			dragHandle = true,
			persistence,
			onAutosaveStateChange,
		} = props

		const containerRef = useRef<HTMLDivElement>(null)
		const onAutosaveStateChangeRef = useRef(onAutosaveStateChange)
		const lastEmittedAutosaveStateRef = useRef<AutosaveState | null>(null)
		const hasAutosaveStateChange = onAutosaveStateChange !== undefined

		useLayoutEffect(() => {
			onAutosaveStateChangeRef.current = onAutosaveStateChange
		}, [onAutosaveStateChange])

		const editor = useEditor({
			initialContent,
			placeholder,
			imageUpload,
			readOnly,
			onChange,
		})
		const autosave = useAutosave({
			editor,
			persistence,
		})

		useEffect(() => {
			if (!hasAutosaveStateChange) {
				lastEmittedAutosaveStateRef.current = null
				return
			}

			const nextState: AutosaveState = {
				isDirty: autosave.isDirty,
				isSaving: autosave.isSaving,
				lastSavedAt: autosave.lastSavedAt,
			}
			const previousState = lastEmittedAutosaveStateRef.current
			if (
				previousState?.isDirty === nextState.isDirty &&
				previousState.isSaving === nextState.isSaving &&
				previousState.lastSavedAt === nextState.lastSavedAt
			) {
				return
			}

			lastEmittedAutosaveStateRef.current = nextState
			onAutosaveStateChangeRef.current?.(nextState)
		}, [
			autosave.isDirty,
			autosave.isSaving,
			autosave.lastSavedAt,
			hasAutosaveStateChange,
		])

		useImperativeHandle(
			ref,
			() => ({
				getMarkdown: () => {
					if (!editor) return ""
					return editor.getMarkdown()
				},
				getHTML: () => {
					if (!editor) return ""
					return editor.getHTML()
				},
				focus: (position?: "start" | "end" | "all") => {
					if (!editor) return
					editor.commands.focus(position)
				},
				hasUnsavedChanges: autosave.hasUnsavedChanges,
				save: async () => {
					if (!editor)
						throw new Error("Cannot save before the editor is ready.")
					if (!persistence?.onAutoSave) {
						throw new Error(
							"Cannot save without a persistence.onAutoSave handler.",
						)
					}
					const markdown = editor.getMarkdown()
					await persistence.onAutoSave(markdown)
					autosave.markContentSaved(markdown)
				},
				commit: async () => {
					if (!editor)
						throw new Error("Cannot commit before the editor is ready.")
					if (!persistence?.onCommit) {
						throw new Error(
							"Cannot commit without a persistence.onCommit handler.",
						)
					}
					// Unlike `publish`, the writer stays here afterwards, and the bytes
					// are in the repository: there is nothing left unsaved to warn about.
					const markdown = editor.getMarkdown()
					const committed = await persistence.onCommit(markdown)
					const imageSources = committed?.imageSources ?? {}
					editor.commands.replaceImageSources(imageSources)
					// What was committed is the sent markdown with the images moved,
					// so anything typed meanwhile still reads as unsaved.
					autosave.markContentSaved(
						Object.entries(imageSources).reduce(
							(moved, [from, to]) => moved.replaceAll(from, to),
							markdown,
						),
					)
				},
				publish: async () => {
					if (!editor)
						throw new Error("Cannot publish before the editor is ready.")
					if (!persistence?.onPublish) {
						throw new Error(
							"Cannot publish without a persistence.onPublish handler.",
						)
					}
					await persistence.onPublish(editor.getMarkdown())
				},
				getEditor: () => editor,
			}),
			[editor, autosave, persistence],
		)

		if (!editor) return null

		return (
			<div
				ref={containerRef}
				className={cn(
					"group/editor relative",
					// The gutter belongs to the writing column, not to whether the
					// editor currently accepts input: dropping it while read-only
					// reflows the column 3rem sideways. The handle inside it is
					// the part that goes away.
					dragHandle && "pl-12",
				)}
			>
				<EditorContent editor={editor} />
				{!readOnly && <EditorBubbleMenu editor={editor} />}
				{!readOnly && dragHandle && (
					<SideMenu editor={editor} containerRef={containerRef} />
				)}
			</div>
		)
	},
)
