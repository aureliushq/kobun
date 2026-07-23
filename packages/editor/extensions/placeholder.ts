import Placeholder from "@tiptap/extension-placeholder"

export const CustomPlaceholderExtension = Placeholder.configure({
	includeChildren: true,
	placeholder: ({ node }) => {
		if (node.type.name === "heading") {
			return `Heading ${node.attrs.level}`
		}
		return "Press '/' for commands..."
	},
})
