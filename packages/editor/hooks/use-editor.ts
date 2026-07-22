import { type Editor, useEditor as useTiptapEditor } from "@tiptap/react"
import { useEffect } from "react"
import { getEditorExtensions } from "../extensions"
import type { ImageUploadAdapter } from "../types"

interface UseEditorOptions {
	imageUpload?: ImageUploadAdapter
	initialContent?: string
	onChange?: (markdown: string) => void
	placeholder?: string
	readOnly?: boolean
}

export function useEditor(options: UseEditorOptions): Editor | null {
	const { imageUpload, initialContent, onChange, placeholder, readOnly } =
		options

	const editor = useTiptapEditor({
		content: initialContent ?? "",
		contentType: "markdown",
		immediatelyRender: false,
		editable: !readOnly,
		editorProps: {
			attributes: {
				class: "prose dark:prose-invert max-w-none focus:outline-none",
			},
		},
		extensions: getEditorExtensions({ placeholder, imageUpload }),
		onUpdate: ({ editor }) => {
			if (onChange) {
				const markdown = editor.getMarkdown()
				onChange(markdown)
			}
		},
	})
	useEffect(() => {
		editor?.setEditable(!readOnly)
	}, [editor, readOnly])

	return editor
}
