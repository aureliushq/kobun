import { render } from "@testing-library/react"
import type { Editor } from "@tiptap/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { EditorBubbleMenu } from "./bubble-menu"

let shouldShow:
	| ((props: { editor: Editor; from: number; to: number }) => boolean)
	| undefined

vi.mock("@tiptap/react/menus", () => ({
	BubbleMenu: ({
		children,
		shouldShow: nextShouldShow,
	}: {
		children: ReactNode
		shouldShow: typeof shouldShow
	}) => {
		shouldShow = nextShouldShow
		return children
	},
}))

function testEditor(isCodeBlock = false) {
	const chain = {
		focus: () => chain,
		extendMarkRange: () => chain,
		run: () => true,
		setLink: () => chain,
		toggleBold: () => chain,
		toggleCode: () => chain,
		toggleItalic: () => chain,
		toggleStrike: () => chain,
		toggleUnderline: () => chain,
		unsetLink: () => chain,
	}
	return {
		chain: () => chain,
		isActive: (name: string) => name === "codeBlock" && isCodeBlock,
	} as unknown as Editor
}

describe("EditorBubbleMenu", () => {
	it("shows for a text selection and hides for a cursor or code block", () => {
		const editor = testEditor()
		render(<EditorBubbleMenu editor={editor} />)

		expect(shouldShow?.({ editor, from: 1, to: 3 })).toBe(true)
		expect(shouldShow?.({ editor, from: 2, to: 2 })).toBe(false)

		const codeEditor = testEditor(true)
		expect(shouldShow?.({ editor: codeEditor, from: 1, to: 3 })).toBe(false)
	})
})
