import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"

export const MarkdownClipboardExtension = Extension.create({
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("markdownClipboard"),
				props: {
					clipboardTextSerializer: (_slice) => {
						return this.editor.getMarkdown()
					},
				},
			}),
		]
	},
	name: "markdownClipboard",
})
