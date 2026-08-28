import type { Editor } from "@tiptap/core"
import { useEffect, useState } from "react"
import { cn } from "@/ui/lib/utils"

export interface EditorWordCountProps {
	className?: string
	editor: Editor | null
}

interface DocumentStats {
	characters: number
	words: number
}

function pluralize(count: number, noun: string) {
	return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`
}

export function EditorWordCount({ className, editor }: EditorWordCountProps) {
	const [stats, setStats] = useState<DocumentStats | null>(null)

	// Subscribing here rather than through `useEditorState`: that hook caches
	// its first snapshot and only refreshes it once a transaction fires, so an
	// editor that arrives after mount — always, since it is created
	// asynchronously — would show no count until the first keystroke.
	useEffect(() => {
		if (!editor) {
			setStats(null)
			return
		}
		// `transaction` rather than `update` so a programmatic replacement that
		// suppresses `update` (`setMarkdown`) still recounts. Selection-only
		// transactions land on identical counts and are dropped below.
		const read = () => {
			const next = {
				characters: editor.storage.characterCount.characters(),
				words: editor.storage.characterCount.words(),
			}
			setStats((current) =>
				current?.characters === next.characters && current.words === next.words
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

	if (!stats) return null

	return (
		<span
			className={cn("text-muted-foreground text-xs tabular-nums", className)}
		>
			{pluralize(stats.words, "word")} ·{" "}
			{pluralize(stats.characters, "character")}
		</span>
	)
}
