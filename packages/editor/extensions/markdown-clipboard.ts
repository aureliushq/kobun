import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"

export const MarkdownClipboardExtension = Extension.create({
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("markdownClipboard"),
				props: {
					clipboardTextSerializer: (slice) => {
						// A selection inside one block arrives as bare inline nodes,
						// which the serializer would set out as separate blocks.
						const nodes = slice.content.toJSON() ?? []
						const content = slice.content.firstChild?.isInline
							? [{ type: "paragraph", content: nodes }]
							: nodes
						return (
							this.editor.markdown?.serialize({ type: "doc", content }) ??
							slice.content.textBetween(0, slice.content.size, "\n\n")
						)
					},
				},
			}),
		]
	},
	name: "markdownClipboard",
})
