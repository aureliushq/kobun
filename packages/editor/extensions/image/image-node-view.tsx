import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"
import { ImageIcon, Loader2, TriangleAlert } from "lucide-react"
import { useEffect, useRef } from "react"

export function ImageNodeView({
	extension,
	node,
	updateAttributes,
}: ReactNodeViewProps) {
	const { alt, errorMessage, file, src, status } = node.attrs
	const adapter = extension.options.uploadAdapter
	const uploadingFileRef = useRef<File | null>(null)

	useEffect(() => {
		if (
			status !== "uploading" ||
			!(file instanceof File) ||
			!adapter ||
			uploadingFileRef.current === file
		) {
			return
		}

		uploadingFileRef.current = file
		void adapter.upload(file).then(
			(uploadedSrc: string) => {
				updateAttributes({
					src: uploadedSrc,
					status: "done",
					file: null,
					errorMessage: null,
				})
			},
			(error: unknown) => {
				updateAttributes({
					status: "error",
					file: null,
					errorMessage:
						error instanceof Error ? error.message : "Unknown upload error",
				})
			},
		)
	}, [adapter, file, status, updateAttributes])

	const resolvedSrc =
		typeof src === "string" ? (adapter?.resolveSrc?.(src) ?? src) : null

	return (
		<NodeViewWrapper className="image-node-view">
			<div className="relative my-4 overflow-hidden rounded-lg border">
				{status === "uploading" && (
					<output
						aria-label="Uploading image"
						className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80"
					>
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</output>
				)}
				{status === "error" && (
					<div className="flex items-center gap-2 p-4 text-destructive text-sm">
						<TriangleAlert className="size-4 shrink-0" />
						<span>Failed to upload: {errorMessage ?? "Unknown error"}</span>
					</div>
				)}
				{resolvedSrc ? (
					<img
						alt={typeof alt === "string" ? alt : ""}
						className="h-auto max-w-full"
						draggable={false}
						src={resolvedSrc}
					/>
				) : (
					<div className="flex items-center justify-center p-8 text-muted-foreground">
						<ImageIcon className="size-8" />
					</div>
				)}
			</div>
		</NodeViewWrapper>
	)
}
