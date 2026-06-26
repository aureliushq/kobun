import StarterKit from "@tiptap/starter-kit"

export function configuredStarterKit() {
	return StarterKit.configure({
		blockquote: false,
		bulletList: {
			HTMLAttributes: { class: "list-disc pl-8" },
		},
		codeBlock: false,
		heading: {
			levels: [1, 2, 3, 4, 5, 6],
		},
		horizontalRule: false,
		listItem: {
			HTMLAttributes: { class: "leading-normal" },
		},
		orderedList: {
			HTMLAttributes: { class: "list-decimal pl-8" },
		},
		paragraph: {
			HTMLAttributes: { class: "leading-relaxed" },
		},
		undoRedo: {},
	})
}
