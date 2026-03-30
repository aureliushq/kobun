import type { Extensions } from "@tiptap/core"
import type { ImageUploadAdapter } from "../types"
import { configuredStarterKit } from "./starter-kit"
import { CustomLinkExtension } from "./link"
import { CustomPlaceholderExtension } from "./placeholder"
import { CustomHorizontalRuleExtension } from "./horizontal-rule"
import { CustomBlockquoteExtension } from "./blockquote"
import { CustomKeymapExtension } from "./keymap"
import { CustomTypographyExtension } from "./typography"
import { MarkdownClipboardExtension } from "./markdown-clipboard"
import { Markdown } from "@tiptap/markdown"
import Underline from "@tiptap/extension-underline"
import { TextStyle } from "@tiptap/extension-text-style"
import CharacterCount from "@tiptap/extension-character-count"

interface ExtensionOptions {
	imageUpload?: ImageUploadAdapter
	placeholder?: string
}

export function getEditorExtensions(options: ExtensionOptions): Extensions {
	return [
		configuredStarterKit(),
		CharacterCount,
		CustomBlockquoteExtension,
		CustomHorizontalRuleExtension,
		CustomLinkExtension,
		CustomKeymapExtension,
		CustomPlaceholderExtension.configure({
			placeholder: options.placeholder ?? "Press '/' for commands...",
		}),
		CustomTypographyExtension,
		Markdown.configure({
			markedOptions: {
				gfm: true,
				breaks: true,
			},
		}),
		MarkdownClipboardExtension,
		TextStyle,
		Underline,
	]
}
