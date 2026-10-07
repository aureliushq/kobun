import { act, render, screen, waitFor } from "@testing-library/react"
import { Sparkles } from "lucide-react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
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

	it("appends custom slash commands", async () => {
		const ref = createRef<EditorRefApi>()
		render(
			<RichTextEditor
				ref={ref}
				dragHandle={false}
				slashCommands={[
					{
						title: "Summary",
						description: "Insert a summary section.",
						icon: Sparkles,
						searchTerms: ["summary", "abstract"],
						command: () => undefined,
					},
				]}
			/>,
		)
		const editor = await waitFor(() => {
			expect(ref.current?.getEditor()).not.toBeNull()
			return ref.current?.getEditor()
		})

		act(() => {
			editor?.commands.focus()
			editor?.commands.insertContent("/summary")
		})

		expect(await screen.findByText("Summary")).toBeVisible()
		expect(screen.queryByText("Heading 1")).not.toBeInTheDocument()
	})
})
