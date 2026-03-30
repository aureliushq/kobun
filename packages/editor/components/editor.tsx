import { EditorContent } from "@tiptap/react"
import { useEditor } from "../hooks/use-editor"
import { cn } from "@/ui/lib/utils"
import type { RichTextEditorProps } from "../types"

export function RichTextEditor(props: RichTextEditorProps) {
	const {
		initialContent,
		placeholder,
		imageUpload,
		onChange,
		readOnly = false,
		className,
	} = props

	const editor = useEditor({
		initialContent,
		placeholder,
		imageUpload,
		readOnly,
		onChange,
	})

	if (!editor) return null

	return (
		<div className={cn("group/editor relative", className)}>
			<EditorContent editor={editor} />
		</div>
	)
}
