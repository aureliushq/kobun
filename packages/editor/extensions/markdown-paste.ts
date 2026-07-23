import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"

export const MarkdownPasteExtension = Extension.create({
	name: "markdownPaste",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("markdownPaste"),
				props: {
					handlePaste: (_view, event) => {
						const clipboard = event.clipboardData
						if (!clipboard || clipboard.getData("text/html")) return false
						const markdownManager = this.editor.markdown
						if (!markdownManager) return false

						const markdown = clipboard.getData("text/plain")
						if (!markdown) return false

						this.editor.commands.insertContent(markdownManager.parse(markdown))
						return true
					},
				},
			}),
		]
	},
})
