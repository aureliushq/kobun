import { act, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { useCallback, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { EditorRefApi } from "../types"
import { RichTextEditor } from "./editor"
import { EditorWordCount } from "./word-count"

vi.mock("./menus/bubble-menu/bubble-menu", () => ({
	EditorBubbleMenu: () => null,
}))

// Mirrors how the collection editor route wires the two together. Storing the
// Tiptap instance rather than the ref API matters: the imperative handle is
// rebuilt on every render, so parking that in state would never settle.
function EditorWithWordCount({
	initialContent,
	onReady,
}: {
	initialContent?: string
	onReady?: (editor: Editor | null) => void
}) {
	const [editor, setEditor] = useState<Editor | null>(null)
	const register = useCallback(
		(api: EditorRefApi | null) => {
			const instance = api?.getEditor() ?? null
			setEditor(instance)
			onReady?.(instance)
		},
		[onReady],
	)

	return (
		<>
			<RichTextEditor
				ref={register}
				dragHandle={false}
				initialContent={initialContent}
			/>
			<EditorWordCount editor={editor} />
		</>
	)
}

describe("EditorWordCount against a real editor", () => {
	it("counts the initial document", async () => {
		render(<EditorWithWordCount initialContent="One two three" />)

		expect(
			await screen.findByText("3 words · 13 characters"),
		).toBeInTheDocument()
	})

	it("updates as content is typed", async () => {
		let editor: Editor | null = null
		render(
			<EditorWithWordCount
				onReady={(instance) => {
					editor = instance
				}}
			/>,
		)
		await waitFor(() => expect(editor).not.toBeNull())

		act(() => {
			editor?.commands.focus()
			editor?.commands.insertContent("Hello")
		})

		expect(await screen.findByText("1 word · 5 characters")).toBeInTheDocument()

		act(() => {
			editor?.commands.insertContent(" world")
		})

		expect(
			await screen.findByText("2 words · 11 characters"),
		).toBeInTheDocument()
	})
})
