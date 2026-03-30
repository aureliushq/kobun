import Blockquote from "@tiptap/extension-blockquote"

export const CustomBlockquoteExtension = Blockquote.extend({
	addKeyboardShortcuts() {
		return {
			Enter: ({ editor }) => {
				if (!editor.isActive("blockquote")) return false
				const { $from } = editor.state.selection
				const isEmpty = $from.parent.content.size === 0
				if (isEmpty) {
					return editor.chain().liftEmptyBlock().run()
				}
				return false
			},
		}
	},
}).configure({
	HTMLAttributes: {
		class: "border-l-4 border-border pl-4 italic text-muted-foreground",
	},
})
