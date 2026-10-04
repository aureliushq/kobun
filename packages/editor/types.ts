import type { Editor, JSONContent } from "@tiptap/core"
import type { SlashCommandItem } from "./extensions/slash-commands/extension"

export interface AutosaveState {
	isDirty: boolean
	isSaving: boolean
	lastSavedAt: Date | null
}

export interface ImageUploadAdapter {
	allowedMimeTypes?: string[]
	maxFileSize?: number
	resolveSrc?: (src: string) => string | undefined
	upload: (file: File) => Promise<string>
	validate?: (file: File) => string | null
}

export interface PersistenceAdapter {
	onAutoSave?: (markdown: string) => void | Promise<void>
	/**
	 * May answer with images the commit moved, keyed by the source each had: the
	 * document follows them, since the writer stays in it afterwards.
	 */
	onCommit?: (
		markdown: string,
		// biome-ignore lint/suspicious/noConfusingVoidType: a handler with nothing to answer returns nothing, as it could before images moved
	) => void | Promise<{ imageSources: Record<string, string> } | void>
	onPublish?: (markdown: string) => void | Promise<void>
}

export interface EditorRefApi {
	clear: () => void
	commit: () => Promise<void>
	focus: (position?: "start" | "end" | "all") => void
	getEditor: () => Editor | null
	getHTML: () => string
	getJSON: () => JSONContent
	getMarkdown: () => string
	hasUnsavedChanges: () => boolean
	publish: () => Promise<void>
	save: () => Promise<void>
	setMarkdown: (markdown: string) => void
}

export interface RichTextEditorProps {
	autosaveDelay?: number
	className?: string
	dragHandle?: boolean
	imageUpload?: ImageUploadAdapter
	initialContent?: string
	onChange?: (markdown: string) => void
	onAutosaveStateChange?: (state: AutosaveState) => void
	persistence?: PersistenceAdapter
	placeholder?: string
	readOnly?: boolean
	ref?: React.Ref<EditorRefApi>
	slashCommands?: SlashCommandItem[]
}
