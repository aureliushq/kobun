import type { Editor } from "@tiptap/core"
import { useEffect, useState } from "react"

export interface ImageUploads {
	/** The names of the images whose upload failed, in document order. */
	failed: string[]
	uploading: number
}

const NONE: ImageUploads = { failed: [], uploading: 0 }

/**
 * The Body's images that are not in its Markdown yet: the serialiser leaves an
 * image out until its upload lands, and leaves a failed one out for good.
 */
export function useImageUploads(editor: Editor | null): ImageUploads {
	const [uploads, setUploads] = useState(NONE)

	// Subscribed the way the word count is, and for the same reasons: the editor
	// arrives after mount, and an upload landing may not emit `update`.
	useEffect(() => {
		if (!editor) {
			setUploads(NONE)
			return
		}
		const read = () => {
			const next: ImageUploads = { failed: [], uploading: 0 }
			editor.state.doc.descendants((node) => {
				if (node.type.name !== "customImage") return
				if (node.attrs.status === "uploading") next.uploading++
				if (node.attrs.status === "error") next.failed.push(node.attrs.alt)
			})
			setUploads((current) =>
				current.uploading === next.uploading &&
				current.failed.join("\n") === next.failed.join("\n")
					? current
					: next,
			)
		}
		read()
		editor.on("transaction", read)
		return () => {
			editor.off("transaction", read)
		}
	}, [editor])

	return uploads
}
