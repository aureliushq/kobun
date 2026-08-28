import { type Editor, useEditor as useTiptapEditor } from "@tiptap/react"
import { useEffect } from "react"
import { getEditorExtensions } from "../extensions"
import type { SlashCommandItem } from "../extensions/slash-commands/extension"
import type { ImageUploadAdapter } from "../types"

/**
 * Parsing empty Markdown yields a document with no nodes at all, which leaves
 * nothing on screen and nothing for the placeholder decoration to attach to.
 * Non-string content is always read as JSON, so this hands the editor a single
 * empty paragraph instead.
 */
const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] }

interface UseEditorOptions {
	imageUpload?: ImageUploadAdapter
	initialContent?: string
	onChange?: (markdown: string) => void
	placeholder?: string
	readOnly?: boolean
	slashCommands?: SlashCommandItem[]
}

export function useEditor(options: UseEditorOptions): Editor | null {
	const {
		imageUpload,
		initialContent,
		onChange,
		placeholder,
		readOnly,
		slashCommands,
	} = options

	const editor = useTiptapEditor({
		content: initialContent?.trim() ? initialContent : EMPTY_DOCUMENT,
		contentType: "markdown",
		immediatelyRender: false,
		editable: !readOnly,
		editorProps: {
			attributes: {
				class: "prose dark:prose-invert max-w-none focus:outline-none",
			},
		},
		extensions: getEditorExtensions({
			placeholder,
			imageUpload,
			slashCommands,
		}),
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
