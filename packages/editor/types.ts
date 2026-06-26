import type { Editor, JSONContent } from "@tiptap/core"

export interface ImageUploadAdapter {
	allowedMimeTypes?: string[]
	maxFileSize?: number
	upload: (file: File) => Promise<string>
	validate?: (file: File) => string | null
}

export interface PersistenceAdapter {
	onAutoSave?: (markdown: string) => void | Promise<void>
	onPublish?: (markdown: string) => void | Promise<void>
}

export interface EditorRefApi {
	clear: () => void
	focus: (position?: "start" | "end" | "all") => void
	getEditor: () => Editor | null
	getHTML: () => string
	getJSON: () => JSONContent
	getMarkdown: () => string
	hasUnsavedChanges: () => boolean
	setMarkdown: (markdown: string) => void
}

export interface RichTextEditorProps {
	autosaveDelay?: number
	className?: string
	dragHandle?: boolean
	imageUpload?: ImageUploadAdapter
	initialContent?: string
	onChange?: (markdown: string) => void
	persistence?: PersistenceAdapter
	placeholder?: string
	readOnly?: boolean
	ref?: React.Ref<EditorRefApi>
}
