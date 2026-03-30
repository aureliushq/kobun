import Link from "@tiptap/extension-link"

export const CustomLinkExtension = Link.configure({
	autolink: true,
	HTMLAttributes: {
		class:
			"text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer",
		rel: "noopener noreferrer nofollow",
		target: "_blank",
	},
	linkOnPaste: true,
	openOnClick: false,
})
