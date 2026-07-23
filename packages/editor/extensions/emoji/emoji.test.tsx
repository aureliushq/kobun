import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { EmojiSuggestionPluginKey } from "@tiptap/extension-emoji"
import { EditorContent } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"
import { useEditor } from "../../hooks/use-editor"
import "../../styles/editor.css"
import { defaultSlashCommands } from "../slash-commands/commands"
import { emojiSuggestionOptions } from "./suggestions"

function EditorHarness({ onReady }: { onReady: (editor: Editor) => void }) {
	const editor = useEditor({})

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

describe("emoji", () => {
	it("converts completed shortcodes and serializes Unicode", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		editor?.commands.insertContent(":smile")
		expect(editor && applyTextInput(editor, ":")).toBe(true)
		expect(editor?.state.doc.firstChild?.firstChild?.type.name).toBe("emoji")
		expect(editor?.getMarkdown()).toBe("😄")
	})

	it("filters autocomplete items by shortcode and tags", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		const items = emojiSuggestionOptions.items({
			editor: editor as Editor,
			query: "celebration",
		})
		expect(items.length).toBeGreaterThan(0)
		expect(items.some((item) => item.name === "tada")).toBe(true)
	})

	it("opens the autocomplete from the emoji slash command", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())
		editor?.commands.insertContent("/emoji")

		const command = defaultSlashCommands.find((item) => item.title === "Emoji")
		command?.command({ editor: editor as Editor, range: { from: 1, to: 7 } })

		expect(editor?.getText()).toBe(":")
		expect(await screen.findByText(":grinning:")).toBeVisible()

		fireEvent.keyDown(editor?.view.dom as HTMLElement, { key: "Enter" })
		expect(editor?.state.doc.firstChild?.firstChild?.type.name).toBe("emoji")
		expect(editor?.getMarkdown()).not.toContain(":")
	})

	it("inserts emoji by command as Unicode markdown", async () => {
		let editor: Editor | undefined
		render(
			<EditorHarness
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())

		expect(editor?.commands.setEmoji("rocket")).toBe(true)
		expect(editor?.getMarkdown()).toBe("🚀")
	})

	it("renders inserted emoji inline at the surrounding text size", async () => {
		let editor: Editor | undefined
		const { container } = render(
			<EditorHarness
				onReady={(value) => {
					editor = value
				}}
			/>,
		)
		await waitFor(() => expect(editor).toBeDefined())
		editor?.commands.insertContent("Before ")
		editor?.commands.setEmoji("smile")
		editor?.commands.insertContent(" after")

		const emoji = await waitFor(() => {
			const element = container.querySelector<HTMLElement>(
				'[data-type="emoji"]',
			)
			expect(element).not.toBeNull()
			return element as HTMLElement
		})

		expect(emoji.parentElement?.tagName).toBe("P")
		expect(emoji).toHaveTextContent("😄")
		expect(emoji.querySelector("img")).toBeNull()
	})

	it("fully exits autocomplete on Escape", async () => {
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
		currentEditor.commands.insertContent(":smile")
		await waitFor(() =>
			expect(
				EmojiSuggestionPluginKey.getState(currentEditor.state)?.active,
			).toBe(true),
		)

		fireEvent.keyDown(currentEditor.view.dom, { key: "Escape" })

		expect(EmojiSuggestionPluginKey.getState(currentEditor.state)?.active).toBe(
			false,
		)
	})
})
