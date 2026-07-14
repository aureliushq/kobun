import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Editor } from "@tiptap/core"
import { EditorContent } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"
import { useEditor } from "../../hooks/use-editor"

interface EditorHarnessProps {
	initialContent?: string
	onReady: (editor: Editor) => void
	readOnly?: boolean
}

function EditorHarness({
	initialContent,
	onReady,
	readOnly,
}: EditorHarnessProps) {
	const editor = useEditor({ initialContent, readOnly })

	useEffect(() => {
		if (editor) onReady(editor)
	}, [editor, onReady])

	return editor ? <EditorContent editor={editor} /> : null
}

function applyTextInput(editor: Editor, text: string) {
	const { from, to } = editor.state.selection

	return editor.view.someProp("handleTextInput", (handler) =>
		handler(editor.view, from, to, text, () =>
			editor.state.tr.insertText(text, from, to),
		),
	)
}

describe("code blocks", () => {
	it.each([
		["```typescript", "typescript"],
		["~~~javascript", "javascript"],
	])("creates a code block from the %s input rule", async (fence, language) => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		editor?.commands.focus()
		editor?.commands.insertContent(fence)
		expect(editor && applyTextInput(editor, " ")).toBe(true)
		expect(editor?.state.doc.firstChild?.type.name).toBe("codeBlock")
		expect(editor?.state.doc.firstChild?.attrs.language).toBe(language)
	})

	it("inserts two spaces with Tab only inside code blocks", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				initialContent={["```text", "line", "```"].join("\n")}
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		editor?.commands.focus("end")
		fireEvent.keyDown(editor?.view.dom as HTMLElement, { key: "Tab" })
		expect(editor?.state.doc.firstChild?.textContent).toBe("line  ")

		editor?.commands.setContent("paragraph")
		editor?.commands.focus("end")
		fireEvent.keyDown(editor?.view.dom as HTMLElement, { key: "Tab" })
		expect(editor?.state.doc.firstChild?.textContent).toBe("paragraph")
	})

	it("highlights code, changes its language, and copies its text", async () => {
		const user = userEvent.setup()
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		})
		let editor: Editor | undefined
		render(
			<EditorHarness
				initialContent={["```typescript", "const answer = 42", "```"].join(
					"\n",
				)}
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		expect(await screen.findByText("const")).toHaveClass("hljs-keyword")
		await user.click(screen.getByRole("button", { name: "Copy code" }))
		expect(writeText).toHaveBeenCalledWith("const answer = 42")
		expect(screen.getByRole("button", { name: "Code copied" })).toBeVisible()

		await user.click(
			screen.getByRole("combobox", { name: "Code block language" }),
		)
		await user.click(await screen.findByRole("option", { name: "javascript" }))
		await waitFor(() =>
			expect(editor?.getMarkdown()).toContain("```javascript"),
		)
	})

	it("prevents language changes in read-only mode", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				initialContent={["```typescript", "const answer = 42", "```"].join(
					"\n",
				)}
				onReady={(value) => {
					editor = value
				}}
				readOnly
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		expect(
			screen.getByRole("combobox", { name: "Code block language" }),
		).toBeDisabled()
		expect(screen.getByRole("button", { name: "Copy code" })).toBeEnabled()
	})
})
