import { Extension } from "@tiptap/core"

export const CustomKeymapExtension = Extension.create({
	addKeyboardShortcuts() {
		return {
			Tab: ({ editor }) => {
				if (editor.isActive("listItem")) {
					return editor.chain().sinkListItem("listItem").run()
				}
				return false
			},
			"Shift-Tab": ({ editor }) => {
				if (editor.isActive("listItem")) {
					return editor.chain().liftListItem("listItem").run()
				}
				return false
			},
		}
	},
	name: "customKeymap",
})
