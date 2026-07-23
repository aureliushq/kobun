import { type JSONContent, Node } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { CalloutNodeView } from "./callout-node-view"
import { normalizeCalloutType } from "./types"

export function createCustomCalloutExtension(
	renderContentAsHTML: (content: JSONContent[]) => string,
) {
	return Node.create({
		name: "callout",
		group: "block",
		content: "block+",
		defining: true,

		addAttributes() {
			return {
				type: {
					default: "info",
					parseHTML: (element) =>
						normalizeCalloutType(element.getAttribute("data-callout")),
					renderHTML: (attributes) => ({
						"data-callout": normalizeCalloutType(attributes.type),
					}),
				},
			}
		},

		parseHTML() {
			return [{ tag: "div[data-callout]" }]
		},

		renderHTML({ HTMLAttributes }) {
			return ["div", HTMLAttributes, 0]
		},

		renderMarkdown(node) {
			const type = normalizeCalloutType(node.attrs?.type)
			const content = renderContentAsHTML(node.content ?? [])

			return `<div data-callout="${type}">${content}</div>`
		},

		addNodeView() {
			return ReactNodeViewRenderer(CalloutNodeView)
		},
	})
}
