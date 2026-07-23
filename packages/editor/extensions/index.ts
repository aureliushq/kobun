import { type Extensions, generateHTML } from "@tiptap/core"
import CharacterCount from "@tiptap/extension-character-count"
import { TextStyle } from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import { Markdown } from "@tiptap/markdown"
import type { ImageUploadAdapter } from "../types"
import { CustomBlockquoteExtension } from "./blockquote"
import { createCustomCalloutExtension } from "./callout/extension"
import { CustomCodeBlockExtension } from "./code-block/extension"
import { DragHandleExtension } from "./drag-handle"
import { CustomEmojiExtension } from "./emoji/extension"
import { CustomHorizontalRuleExtension } from "./horizontal-rule"
import { CustomImageExtension } from "./image/extension"
import { CustomKeymapExtension } from "./keymap"
import { CustomLinkExtension } from "./link"
import { MarkdownClipboardExtension } from "./markdown-clipboard"
import { MarkdownPasteExtension } from "./markdown-paste"
import { CustomPlaceholderExtension } from "./placeholder"
import type { SlashCommandItem } from "./slash-commands/extension"
import { SlashCommandsExtension } from "./slash-commands/extension"
import { createSlashSuggestionOptions } from "./slash-commands/suggestions"
import { configuredStarterKit } from "./starter-kit"
import { CustomTypographyExtension } from "./typography"

interface ExtensionOptions {
	imageUpload?: ImageUploadAdapter
	placeholder?: string
	slashCommands?: SlashCommandItem[]
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
	const extensions: Extensions = []
	const calloutExtension = createCustomCalloutExtension((content) =>
		generateHTML({ type: "doc", content }, extensions),
	)

	extensions.push(
		configuredStarterKit(),
		CharacterCount,
		CustomBlockquoteExtension,
		calloutExtension,
		CustomCodeBlockExtension,
		DragHandleExtension,
		CustomEmojiExtension,
		CustomHorizontalRuleExtension,
		CustomImageExtension.configure({ uploadAdapter: options.imageUpload }),
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
		MarkdownPasteExtension,
		SlashCommandsExtension.configure({
			suggestion: createSlashSuggestionOptions(options.slashCommands),
		}),
		TextStyle,
		MarkdownUnderlineExtension,
	)

	return extensions
}
