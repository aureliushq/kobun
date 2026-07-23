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
			className,
			persistence,
			autosaveDelay,
			onAutosaveStateChange,
			slashCommands,
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
			slashCommands,
		})
		const autosave = useAutosave({
			editor,
			persistence,
			delay: autosaveDelay,
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
				getJSON: () => {
					if (!editor) return { type: "doc", content: [] }
					return editor.getJSON()
				},
				getHTML: () => {
					if (!editor) return ""
					return editor.getHTML()
				},
				setMarkdown: (markdown: string) => {
					if (!editor) return
					editor.commands.setContent(markdown, {
						contentType: "markdown",
						emitUpdate: false,
					})
					autosave.markCurrentContentClean()
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
				clear: () => {
					if (!editor) return
					editor.commands.clearContent()
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
					!readOnly && dragHandle && "pl-12",
					className,
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
