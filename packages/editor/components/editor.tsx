import { EditorContent } from "@tiptap/react"
import { forwardRef, useImperativeHandle, useRef } from "react"
import { cn } from "@/ui/lib/utils"
import { useEditor } from "../hooks/use-editor"
import type { EditorRefApi, RichTextEditorProps } from "../types"
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
		} = props

		const containerRef = useRef<HTMLDivElement>(null)

		const editor = useEditor({
			initialContent,
			placeholder,
			imageUpload,
			readOnly,
			onChange,
		})

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
					editor.commands.setContent(markdown)
				},
				focus: (position?: "start" | "end" | "all") => {
					if (!editor) return
					editor.commands.focus(position)
				},
				hasUnsavedChanges: () => false, // wired to autosave in Phase 10
				clear: () => {
					if (!editor) return
					editor.commands.clearContent()
				},
				getEditor: () => editor,
			}),
			[editor],
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
