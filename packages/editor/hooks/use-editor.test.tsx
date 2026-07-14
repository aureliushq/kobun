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
})
