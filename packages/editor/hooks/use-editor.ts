import { type Editor, useEditor as useTiptapEditor } from "@tiptap/react"
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
		immediatelyRender: false,
		editable: !readOnly,
		editorProps: {
			attributes: {
				class:
					"prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px] px-4 py-3",
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

	return editor
}
