import type { Editor } from "@tiptap/core"
import { Check, Trash2 } from "lucide-react"
import { type FormEvent, useCallback, useState } from "react"
import { Button } from "@/ui/components/base/button"
import { Input } from "@/ui/components/base/input"

interface LinkSelectorProps {
	editor: Editor
	onSetLink: (url: string) => void
	onClose: () => void
}

export function LinkSelector({
	editor,
	onSetLink,
	onClose: _onClose,
}: LinkSelectorProps) {
	const existingHref = editor.getAttributes("link").href ?? ""
	const [url, setUrl] = useState(existingHref)

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault()
			onSetLink(url)
		},
		[url, onSetLink],
	)

	return (
		<form
			onSubmit={handleSubmit}
			className="ml-1 flex items-center gap-1 border-l pl-1"
		>
			<Input
				type="url"
				placeholder="https://..."
				value={url}
				onChange={(e) => setUrl(e.target.value)}
				className="w-48"
				autoFocus
			/>
			<Button type="submit" variant="ghost" size="icon-sm">
				<Check />
			</Button>
			{existingHref && (
				<Button
					type="button"
					variant="destructive"
					size="icon-sm"
					onClick={() => onSetLink("")}
				>
					<Trash2 />
				</Button>
			)}
		</form>
	)
}
