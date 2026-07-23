import { mergeAttributes, Node } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { ImageUploadAdapter } from "../../types"
import { ImageNodeView } from "./image-node-view"

const defaultMaxFileSize = 5 * 1024 * 1024
const defaultAllowedMimeTypes = ["image/*"]

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		customImage: {
			insertImageComponent: (file: File) => ReturnType
		}
	}
}

export function validateImageFile(
	file: File,
	adapter: ImageUploadAdapter,
): string | null {
	const customError = adapter.validate?.(file)
	if (customError) return customError

	const maxFileSize = adapter.maxFileSize ?? defaultMaxFileSize
	if (file.size > maxFileSize) {
		return `Image must be ${maxFileSize} bytes or smaller.`
	}

	const allowedMimeTypes = adapter.allowedMimeTypes ?? defaultAllowedMimeTypes
	const isAllowed = allowedMimeTypes.some((allowedType) =>
		allowedType.endsWith("/*")
			? file.type.startsWith(allowedType.slice(0, -1))
			: file.type === allowedType,
	)

	return isAllowed
		? null
		: `Image type ${file.type || "unknown"} is not allowed.`
}

export const CustomImageExtension = Node.create<{
	uploadAdapter?: ImageUploadAdapter
}>({
	name: "customImage",
	group: "block",
	atom: true,
	draggable: true,

	addOptions() {
		return { uploadAdapter: undefined }
	},

	addAttributes() {
		return {
			src: { default: null },
			alt: { default: null },
			title: { default: null },
			status: { default: "idle", rendered: false },
			file: { default: null, rendered: false },
			errorMessage: { default: null, rendered: false },
		}
	},

	parseHTML() {
		return [{ tag: "img[src]" }]
	},

	renderHTML({ HTMLAttributes }) {
		return ["img", mergeAttributes(HTMLAttributes)]
	},

	markdownTokenName: "image",
	parseMarkdown: (token, helpers) =>
		helpers.createNode("customImage", {
			src: token.href,
			alt: token.text,
			title: token.title,
			status: "done",
		}),
	renderMarkdown: (node) => {
		const src = node.attrs?.src ?? ""
		const alt = node.attrs?.alt ?? ""
		const title = node.attrs?.title ?? ""
		if (!src) return ""
		return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`
	},

	addNodeView() {
		return ReactNodeViewRenderer(ImageNodeView)
	},

	addCommands() {
		return {
			insertImageComponent:
				(file) =>
				({ chain }) => {
					const adapter = this.options.uploadAdapter
					if (!adapter || validateImageFile(file, adapter)) return false

					return chain()
						.insertContent({
							type: this.name,
							attrs: {
								src: URL.createObjectURL(file),
								alt: file.name,
								status: "uploading",
								file,
							},
						})
						.run()
				},
		}
	},

	addProseMirrorPlugins() {
		if (!this.options.uploadAdapter) return []

		return [
			new Plugin({
				key: new PluginKey("imageUpload"),
				props: {
					handlePaste: (_view, event) => {
						const file = Array.from(event.clipboardData?.items ?? [])
							.find(
								(item) =>
									item.kind === "file" && item.type.startsWith("image/"),
							)
							?.getAsFile()
						if (!file) return false
						event.preventDefault()
						return this.editor.commands.insertImageComponent(file)
					},
					handleDrop: (_view, event) => {
						const imageFiles = Array.from(
							event.dataTransfer?.files ?? [],
						).filter((file) => file.type.startsWith("image/"))
						if (imageFiles.length === 0) return false
						event.preventDefault()
						for (const file of imageFiles) {
							this.editor.commands.insertImageComponent(file)
						}
						return true
					},
				},
			}),
		]
	},
})
