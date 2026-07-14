import type { Extensions } from "@tiptap/core"
import CharacterCount from "@tiptap/extension-character-count"
import { TextStyle } from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import { Markdown } from "@tiptap/markdown"
import type { ImageUploadAdapter } from "../types"
import { CustomBlockquoteExtension } from "./blockquote"
import { DragHandleExtension } from "./drag-handle"
import { CustomHorizontalRuleExtension } from "./horizontal-rule"
import { CustomKeymapExtension } from "./keymap"
import { CustomLinkExtension } from "./link"
import { MarkdownClipboardExtension } from "./markdown-clipboard"
import { CustomPlaceholderExtension } from "./placeholder"
import { SlashCommandsExtension } from "./slash-commands/extension"
import { configuredStarterKit } from "./starter-kit"
import { CustomTypographyExtension } from "./typography"

interface ExtensionOptions {
	imageUpload?: ImageUploadAdapter
	placeholder?: string
}

export const editorMarkdownOptions = {
	breaks: true,
	gfm: true,
}

const MarkdownUnderlineExtension = Underline.extend({
	renderMarkdown(node, helpers) {
		return `<u>${helpers.renderChildren(node)}</u>`
	},
})

export function getEditorExtensions(options: ExtensionOptions): Extensions {
	return [
		configuredStarterKit(),
		CharacterCount,
		CustomBlockquoteExtension,
		DragHandleExtension,
		CustomHorizontalRuleExtension,
		CustomLinkExtension,
		CustomKeymapExtension,
		CustomPlaceholderExtension.configure({
			placeholder: options.placeholder ?? "Press '/' for commands...",
		}),
		CustomTypographyExtension,
		Markdown.configure({
			markedOptions: editorMarkdownOptions,
		}),
		MarkdownClipboardExtension,
		SlashCommandsExtension,
		TextStyle,
		MarkdownUnderlineExtension,
	]
}
