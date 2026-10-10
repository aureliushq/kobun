import { act, render, screen, waitFor } from "@testing-library/react"
import { Editor } from "@tiptap/core"
import { TextSelection } from "@tiptap/pm/state"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { getEditorExtensions } from "../extensions"
import type { EditorRefApi } from "../types"
import { RichTextEditor } from "./editor"

vi.mock("./menus/bubble-menu/bubble-menu", () => ({
	EditorBubbleMenu: () => null,
}))

describe("RichTextEditor interactions", () => {
	it("renders formatted initial Markdown", async () => {
		render(
			<RichTextEditor
				dragHandle={false}
				initialContent="# Heading\n\nA **formatted** paragraph."
			/>,
		)

		expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
			"Heading",
		)
		expect(screen.getByText("formatted").tagName).toBe("STRONG")
	})

	it("shows a placeholder in an empty document", async () => {
		const { container } = render(
			<RichTextEditor dragHandle={false} placeholder="Start writing..." />,
		)

		// Empty Markdown parses to a document with no nodes, so the paragraph
		// carrying the placeholder has to exist for anything to show.
		const paragraph = await waitFor(() => {
			const node = container.querySelector(".ProseMirror > p")
			expect(node).not.toBeNull()
			return node as HTMLElement
		})

		expect(paragraph).toHaveAttribute("data-placeholder", "Start writing...")
	})

	it("copies only the selection as plain text", async () => {
		const ref = createRef<EditorRefApi>()
		render(
			<RichTextEditor
				ref={ref}
				dragHandle={false}
				initialContent={"First **paragraph**.\n\nSecond one."}
			/>,
		)
		const editor = await waitFor(() => {
			expect(ref.current?.getEditor()).not.toBeNull()
			return ref.current?.getEditor()
		})
		const { view } = editor ?? {}
		if (!view) throw new Error("Editor view missing")

		// "First **paragraph**" — positions 1 to 16 inside the first paragraph.
		const text = view.someProp("clipboardTextSerializer", (serialize) =>
			serialize(view.state.doc.slice(1, 16), view),
		)

		expect(text).toBe("First **paragraph**")
	})

	it("reads a single newline as a soft wrap, not a line break", async () => {
		const ref = createRef<EditorRefApi>()
		render(
			<RichTextEditor
				ref={ref}
				dragHandle={false}
				initialContent={"Hard-wrapped\nsentence.\n\nKept  \nbreak."}
			/>,
		)
		const editor = await waitFor(() => {
			expect(ref.current?.getEditor()).not.toBeNull()
			return ref.current?.getEditor()
		})

		expect(editor?.getHTML()).toMatch(/<p[^>]*>Hard-wrapped sentence\.<\/p>/)
		expect(editor?.getHTML()).toMatch(/Kept<br>break\./)
	})

	it("opens and filters the slash menu as a query is typed", async () => {
		const ref = createRef<EditorRefApi>()
		render(<RichTextEditor ref={ref} dragHandle={false} />)
		const editor = await waitFor(() => {
			expect(ref.current?.getEditor()).not.toBeNull()
			return ref.current?.getEditor()
		})

		act(() => {
			editor?.commands.focus()
			editor?.commands.insertContent("/head")
		})

		expect(await screen.findByText("Heading 1")).toBeVisible()
		expect(screen.getByText("Heading 6")).toBeVisible()
		expect(screen.queryByText("Bullet List")).not.toBeInTheDocument()
	})

	it("nests a list item on Tab and lifts it on Shift-Tab", async () => {
		const ref = createRef<EditorRefApi>()
		render(
			<RichTextEditor
				ref={ref}
				dragHandle={false}
				initialContent={"- first\n- second"}
			/>,
		)
		const editor = await waitFor(() => {
			expect(ref.current?.getEditor()).not.toBeNull()
			return ref.current?.getEditor()
		})
		if (!editor) throw new Error("Editor missing")
		const press = (key: string, shiftKey = false) => {
			const event = new KeyboardEvent("keydown", { key, shiftKey })
			editor.view.someProp("handleKeyDown", (handle) =>
				handle(editor.view, event),
			)
		}

		act(() => {
			const end = editor.state.doc.content.size - 3
			editor.view.dispatch(
				editor.state.tr.setSelection(
					TextSelection.create(editor.state.doc, end),
				),
			)
			press("Tab")
		})
		expect(editor.getMarkdown().trim()).toBe("- first\n  - second")

		act(() => press("Tab", true))
		expect(editor.getMarkdown().trim()).toBe("- first\n- second")
	})
})

describe("Markdown round-trip", () => {
	function roundTrip(markdown: string) {
		const editor = new Editor({
			content: markdown,
			contentType: "markdown",
			extensions: getEditorExtensions({}),
		})
		const serialized = editor.getMarkdown()
		editor.destroy()
		return serialized
	}

	it.each([
		[
			"CommonMark and GFM",
			[
				"# Title",
				"",
				"A **bold**, *italic*, ~~removed~~ paragraph with `code` and [a link](https://example.com).",
				"",
				"- first",
				"- second",
				"",
				"1. ordered first",
				"2. ordered second",
				"",
				"> quoted",
				"",
				"---",
				"",
				'![Alt text](https://example.com/image.png "Image title")',
			].join("\n"),
		],
		["underline as raw HTML", "This is <u>underlined</u>."],
		[
			"fenced code with its language",
			["```typescript", 'const greeting = "hello"', "```"].join("\n"),
		],
	])("keeps %s", (_name, markdown) => {
		expect(roundTrip(markdown)).toBe(markdown)
	})

	it("keeps callouts as raw HTML and emoji as Unicode", () => {
		const serialized = roundTrip(
			'<div data-callout="error"><p>Failed <strong>badly</strong> 😱</p></div>',
		)

		expect(serialized).toContain('data-callout="error"')
		expect(serialized).toContain("<strong>badly</strong> 😱")
		expect(roundTrip(serialized)).toBe(serialized)
	})

	it("writes tilde fences back as backtick fences", () => {
		expect(
			roundTrip(["~~~javascript", "console.log(1)", "~~~"].join("\n")),
		).toBe(["```javascript", "console.log(1)", "```"].join("\n"))
	})
})
