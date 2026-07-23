import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Editor } from "@tiptap/core"
import { EditorContent } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"
import { useEditor } from "../../hooks/use-editor"
import { defaultSlashCommands } from "../slash-commands/commands"

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

describe("callouts", () => {
	it("loads and roundtrips rich callout content as raw HTML", async () => {
		const markdown =
			'<div data-callout="warning"><p>Read <strong>this</strong>.</p><ul><li><p>First</p></li></ul><pre><code class="language-typescript">const value = 1</code></pre></div>'
		let editor: Editor | undefined
		render(
			<EditorHarness
				initialContent={markdown}
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		expect(editor?.state.doc.firstChild?.type.name).toBe("callout")
		expect(editor?.state.doc.firstChild?.attrs.type).toBe("warning")
		expect(editor?.state.doc.firstChild?.lastChild?.attrs.language).toBe(
			"typescript",
		)
		const serialized = editor?.getMarkdown() ?? ""
		expect(serialized).toContain("<strong>this</strong>")
		expect(serialized).toContain('class="language-typescript"')

		editor?.commands.setContent(serialized, {
			contentType: "markdown",
		})
		expect(editor?.state.doc.firstChild?.lastChild?.attrs.language).toBe(
			"typescript",
		)
		expect(editor?.getMarkdown().trim()).toBe(serialized.trim())
	})

	it("changes callout type and disables the selector when read-only", async () => {
		const user = userEvent.setup()
		let editor: Editor | undefined
		const editableView = render(
			<EditorHarness
				initialContent={'<div data-callout="info"><p>Note</p></div>'}
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		await user.click(screen.getByRole("combobox", { name: "Callout type" }))
		await user.click(await screen.findByRole("option", { name: "Success" }))
		expect(editor?.getMarkdown()).toContain('data-callout="success"')

		editableView.unmount()
		render(
			<EditorHarness
				initialContent={'<div data-callout="success"><p>Note</p></div>'}
				onReady={() => undefined}
				readOnly
			/>,
		)
		await waitFor(() =>
			expect(
				screen.getByRole("combobox", { name: "Callout type" }),
			).toBeDisabled(),
		)
	})

	it("inserts an info callout from the slash command", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				initialContent="/callout"
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		const command = defaultSlashCommands.find(
			(item) => item.title === "Callout",
		)
		command?.command({ editor: editor as Editor, range: { from: 1, to: 9 } })

		expect(editor?.state.doc.firstChild?.type.name).toBe("callout")
		expect(editor?.state.doc.firstChild?.attrs.type).toBe("info")
	})

	it("normalizes unsupported callout types to info", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				initialContent={'<div data-callout="unknown"><p>Note</p></div>'}
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		expect(editor?.state.doc.firstChild?.attrs.type).toBe("info")
		expect(editor?.getMarkdown()).toContain('data-callout="info"')
	})
})
