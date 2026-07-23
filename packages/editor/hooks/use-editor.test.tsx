import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useEditor } from "./use-editor"

describe("useEditor", () => {
	it("parses initial content as Markdown", async () => {
		const markdown = "# Heading\n\n- one\n- two\n\n[Link](https://example.com)"
		const { result } = renderHook(() => useEditor({ initialContent: markdown }))

		await waitFor(() => expect(result.current).not.toBeNull())

		expect(result.current?.getHTML()).toContain("<h1>Heading</h1>")
		expect(result.current?.getHTML()).toContain("<ul ")
		expect(result.current?.getHTML()).toContain('href="https://example.com"')
		expect(result.current?.getMarkdown()).toBe(markdown)
	})

	it("preserves GFM and raw HTML after editing loaded Markdown", async () => {
		const markdown = "Text with ~~strike~~ and <u>underline</u>."
		const { result } = renderHook(() => useEditor({ initialContent: markdown }))

		await waitFor(() => expect(result.current).not.toBeNull())

		const editor = result.current
		expect(editor?.getHTML()).toContain("<s>strike</s>")
		expect(editor?.getHTML()).toContain("<u>underline</u>")

		editor?.commands.insertContentAt(
			editor.state.doc.content.size - 1,
			" Edited",
		)

		expect(editor?.getMarkdown()).toBe(`${markdown} Edited`)
	})
})
