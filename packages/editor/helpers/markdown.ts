import { generateHTML, generateJSON } from "@tiptap/core"
import { MarkdownManager } from "@tiptap/markdown"
import { editorMarkdownOptions, getEditorExtensions } from "../extensions"

const extensions = getEditorExtensions({})
const markdownManager = new MarkdownManager({
	extensions,
	markedOptions: editorMarkdownOptions,
})

export function htmlToMarkdown(html: string): string {
	return markdownManager.serialize(generateJSON(html, extensions))
}

export function markdownToHtml(markdown: string): string {
	return generateHTML(markdownManager.parse(markdown), extensions)
}
