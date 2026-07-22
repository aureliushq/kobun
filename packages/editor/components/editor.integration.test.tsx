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
