import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { EditorContent } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"
import { useEditor } from "../../hooks/use-editor"
import "../../styles/editor.css"
import { slashCommandPluginKey } from "./extension"

function EditorHarness({ onReady }: { onReady: (editor: Editor) => void }) {
	const editor = useEditor({})

	useEffect(() => {
		if (editor) onReady(editor)
	}, [editor, onReady])

	return editor ? <EditorContent editor={editor} /> : null
}

describe("slash commands", () => {
	it("opens the menu at the cursor and fully exits on Escape", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())
		const currentEditor = editor as Editor
		currentEditor.commands.insertContent("/head")

		const item = await screen.findByText("Heading 1")
		expect(item).toBeVisible()

		fireEvent.keyDown(currentEditor.view.dom, { key: "Escape" })

		expect(slashCommandPluginKey.getState(currentEditor.state)?.active).toBe(
			false,
		)
		await waitFor(() => expect(item).not.toBeInTheDocument())
	})
})
