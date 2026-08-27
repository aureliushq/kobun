import { render } from "@testing-library/react"
import type { Editor } from "@tiptap/react"
import type { BubbleMenuProps } from "@tiptap/react/menus"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { EditorBubbleMenu } from "./bubble-menu"

type ShouldShow = NonNullable<BubbleMenuProps["shouldShow"]>
type ShouldShowProps = Parameters<ShouldShow>[0]

let shouldShow: ShouldShow | undefined

vi.mock("@tiptap/react/menus", () => ({
	BubbleMenu: ({
		children,
		shouldShow: nextShouldShow,
	}: {
		children: ReactNode
		shouldShow: ShouldShow
	}) => {
		shouldShow = nextShouldShow
		return children
	},
}))

function testEditor({
	isCodeBlock = false,
	isEditable = true,
}: {
	isCodeBlock?: boolean
	isEditable?: boolean
} = {}) {
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
		isEditable,
	} as unknown as Editor
}

function props({
	editor = testEditor(),
	from = 1,
	to = 3,
	text = "hi",
	hasFocus = true,
	menuHasFocus = false,
}: {
	editor?: Editor
	from?: number
	to?: number
	text?: string
	hasFocus?: boolean
	menuHasFocus?: boolean
} = {}): ShouldShowProps {
	return {
		editor,
		element: { contains: () => menuHasFocus } as unknown as HTMLElement,
		view: { hasFocus: () => hasFocus },
		state: {
			doc: { textBetween: () => text },
			selection: { empty: from === to },
		},
		from,
		to,
	} as unknown as ShouldShowProps
}

describe("EditorBubbleMenu", () => {
	it("decides visibility from the selection, focus, and editability", () => {
		render(<EditorBubbleMenu editor={testEditor()} />)

		// A focused editor with text selected is the one case that shows.
		expect(shouldShow?.(props())).toBe(true)

		// A collapsed cursor has nothing to format.
		expect(shouldShow?.(props({ from: 2, to: 2 }))).toBe(false)

		// Formatting marks do not apply inside a code block.
		expect(
			shouldShow?.(props({ editor: testEditor({ isCodeBlock: true }) })),
		).toBe(false)

		// The reported bug: nothing focused, so the menu must stay down.
		expect(shouldShow?.(props({ hasFocus: false }))).toBe(false)

		// ...unless focus moved into the menu itself, as the link input does.
		expect(shouldShow?.(props({ hasFocus: false, menuHasFocus: true }))).toBe(
			true,
		)

		// A range holding no text — an empty block, or a node selection on an
		// image or horizontal rule.
		expect(shouldShow?.(props({ text: "" }))).toBe(false)

		// A read-only editor has no formatting to offer.
		expect(
			shouldShow?.(props({ editor: testEditor({ isEditable: false }) })),
		).toBe(false)
	})
})
