import type { Meta, StoryObj } from "@storybook/react-vite"
import { RichTextEditor } from "./editor"

const meta = {
	title: "Packages/Editor/RichTextEditor",
	component: RichTextEditor,
	decorators: [
		(Story) => (
			<div className="mx-auto min-h-[720px] max-w-3xl px-8 py-12">
				<Story />
			</div>
		),
	],
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof RichTextEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {},
	parameters: {
		docs: {
			description: {
				story:
					"Type `/` to open the slash menu. Hover a block to reveal the drag handle, or select text to open the bubble menu.",
			},
		},
	},
}

export const WithInitialContent: Story = {
	args: {
		initialContent: `# A Markdown-first editor

Select this sentence to open the **bubble menu**, or type a slash below to insert a new block.

> Content stays portable because Markdown remains the source of truth.

- CommonMark structure
- GFM strikethrough
- Rich editing controls`,
	},
}

export const ReadOnly: Story = {
	args: {
		initialContent: `# Published document

This content can be read and selected, but it cannot be edited.

1. Editing menus are hidden
2. The document remains fully rendered`,
		readOnly: true,
	},
}

export const WithImageUpload: Story = {
	args: {
		imageUpload: {
			allowedMimeTypes: ["image/*"],
			maxFileSize: 5 * 1024 * 1024,
			upload: async (file) => URL.createObjectURL(file),
		},
		initialContent:
			"# Image uploads\n\nType `/image`, select a local image, and the mock adapter will insert it into the document.",
	},
}
