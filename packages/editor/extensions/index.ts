import { type Extensions, generateHTML } from "@tiptap/core"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import { CharacterCount, Placeholder } from "@tiptap/extensions"
import { Markdown } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import { Tokenizer } from "marked"
import type { ImageUploadAdapter } from "../types"
import { CustomBlockquoteExtension } from "./blockquote"
import { createCustomCalloutExtension } from "./callout/extension"
import { CustomCodeBlockExtension } from "./code-block/extension"
import { DragHandleExtension } from "./drag-handle"
import { CustomEmojiExtension } from "./emoji/extension"
import { CustomHorizontalRuleExtension } from "./horizontal-rule"
import { CustomImageExtension } from "./image/extension"
import { MarkdownClipboardExtension } from "./markdown-clipboard"
import { MarkdownPasteExtension } from "./markdown-paste"
import { SlashCommandsExtension } from "./slash-commands/extension"

interface ExtensionOptions {
	imageUpload?: ImageUploadAdapter
	placeholder?: string
}

/**
 * A single newline inside a paragraph is a soft wrap: hard-wrapped Markdown
 * files and pasted plain text use it mid-sentence. Marked keeps it in the text,
 * and the editor shows it as a line break, so it becomes a space here. A real
 * break (`"  \n"` or Shift+Enter) is a separate token and is kept.
 */
class SoftWrapTokenizer extends Tokenizer {
	override inlineText(src: string) {
		const token = super.inlineText(src)
		if (token && !token.escaped) token.text = token.text.replace(/ *\n */g, " ")
		return token
	}
}

const editorMarkdownOptions = {
	breaks: false,
	gfm: true,
	tokenizer: new SoftWrapTokenizer(),
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
		StarterKit.configure({
			blockquote: false,
			bulletList: {
				HTMLAttributes: { class: "list-disc pl-8" },
			},
			codeBlock: false,
			heading: {
				levels: [1, 2, 3, 4, 5, 6],
			},
			horizontalRule: false,
			link: {
				autolink: true,
				HTMLAttributes: {
					class:
						"text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer",
					rel: "noopener noreferrer nofollow",
					target: "_blank",
				},
				linkOnPaste: true,
				openOnClick: false,
			},
			listItem: {
				HTMLAttributes: { class: "leading-normal" },
			},
			orderedList: {
				HTMLAttributes: { class: "list-decimal pl-8" },
			},
			paragraph: {
				HTMLAttributes: { class: "leading-relaxed" },
			},
			underline: false,
			undoRedo: {},
		}),
		CharacterCount,
		CustomBlockquoteExtension,
		calloutExtension,
		CustomCodeBlockExtension,
		DragHandleExtension,
		CustomEmojiExtension,
		CustomHorizontalRuleExtension,
		CustomImageExtension.configure({ uploadAdapter: options.imageUpload }),
		Placeholder.configure({
			includeChildren: true,
			placeholder: ({ node }) =>
				node.type.name === "heading"
					? `Heading ${node.attrs.level}`
					: (options.placeholder ?? "Press '/' for commands..."),
		}),
		Typography,
		Markdown.configure({
			markedOptions: editorMarkdownOptions,
		}),
		MarkdownClipboardExtension,
		MarkdownPasteExtension,
		SlashCommandsExtension,
		MarkdownUnderlineExtension,
	)

	return extensions
}
