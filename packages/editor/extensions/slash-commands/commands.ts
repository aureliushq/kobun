import {
	BadgeInfo,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	Heading5,
	Heading6,
	ImageIcon,
	List,
	ListOrdered,
	Minus,
	Quote,
	Smile,
	Type,
} from "lucide-react"
import type { SlashCommandItem } from "./extension"

export const defaultSlashCommands: SlashCommandItem[] = [
	{
		title: "Text",
		description: "Just start writing with plain text.",
		icon: Type,
		searchTerms: ["paragraph", "text", "plain"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setNode("paragraph").run()
		},
	},
	{
		title: "Heading 1",
		description: "Large section heading.",
		icon: Heading1,
		searchTerms: ["h1", "heading", "title", "large"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 1 })
				.run()
		},
	},
	{
		title: "Heading 2",
		description: "Medium section heading.",
		icon: Heading2,
		searchTerms: ["h2", "heading", "subtitle", "medium"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 2 })
				.run()
		},
	},
	{
		title: "Heading 3",
		description: "Small section heading.",
		icon: Heading3,
		searchTerms: ["h3", "heading", "small"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 3 })
				.run()
		},
	},
	{
		title: "Heading 4",
		description: "Heading level 4.",
		icon: Heading4,
		searchTerms: ["h4", "heading"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 4 })
				.run()
		},
	},
	{
		title: "Heading 5",
		description: "Heading level 5.",
		icon: Heading5,
		searchTerms: ["h5", "heading"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 5 })
				.run()
		},
	},
	{
		title: "Heading 6",
		description: "Heading level 6.",
		icon: Heading6,
		searchTerms: ["h6", "heading"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 6 })
				.run()
		},
	},
	{
		title: "Bullet List",
		description: "Create a simple bullet list.",
		icon: List,
		searchTerms: ["unordered", "bullet", "list", "ul"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run()
		},
	},
	{
		title: "Numbered List",
		description: "Create a numbered list.",
		icon: ListOrdered,
		searchTerms: ["ordered", "numbered", "list", "ol"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run()
		},
	},
	{
		title: "Quote",
		description: "Capture a quote.",
		icon: Quote,
		searchTerms: ["blockquote", "quote", "cite"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run()
		},
	},
	{
		title: "Callout",
		description: "Highlight important information.",
		icon: BadgeInfo,
		searchTerms: ["aside", "alert", "info", "warning", "error", "success"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.wrapIn("callout", { type: "info" })
				.run()
		},
	},
	{
		title: "Code",
		description: "Insert a code block.",
		icon: Code,
		searchTerms: ["code", "codeblock", "snippet", "fence"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
		},
	},
	{
		title: "Divider",
		description: "Insert a horizontal divider.",
		icon: Minus,
		searchTerms: ["hr", "divider", "horizontal", "rule", "separator"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run()
		},
	},
	{
		title: "Image",
		description: "Upload an image from your device.",
		icon: ImageIcon,
		searchTerms: ["image", "photo", "picture", "upload"],
		command: ({ editor, range }) => {
			const input = document.createElement("input")
			input.type = "file"
			input.accept = "image/*"
			input.addEventListener(
				"change",
				() => {
					const file = input.files?.[0]
					if (file) editor.commands.insertImageComponent(file)
				},
				{ once: true },
			)
			editor.chain().focus().deleteRange(range).run()
			input.click()
		},
	},
	{
		title: "Emoji",
		description: "Insert an emoji by shortcode.",
		icon: Smile,
		searchTerms: ["emoji", "emoticon", "smiley", "shortcode"],
		command: ({ editor, range }) => {
			editor.chain().focus().insertContentAt(range, ":").run()
		},
	},
]
