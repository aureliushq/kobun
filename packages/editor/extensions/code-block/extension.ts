import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { common, createLowlight } from "lowlight"
import { CodeBlockNodeView } from "./code-block-node-view"

const lowlight = createLowlight(common)

export const CustomCodeBlockExtension = CodeBlockLowlight.extend({
	parseMarkdown: (token, helpers) => {
		const isFencedCode =
			token.raw?.startsWith("```") || token.raw?.startsWith("~~~")

		if (!isFencedCode && token.codeBlockStyle !== "indented") {
			return []
		}

		return helpers.createNode(
			"codeBlock",
			{ language: token.lang || null },
			token.text ? [helpers.createTextNode(token.text)] : [],
		)
	},

	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockNodeView)
	},
}).configure({
	enableTabIndentation: true,
	lowlight,
	tabSize: 2,
})
