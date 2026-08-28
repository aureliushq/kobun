import { render, screen } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { EditorWordCount } from "./word-count"

function createTestEditor(words: number, characters: number) {
	return {
		storage: {
			characterCount: {
				characters: () => characters,
				words: () => words,
			},
		},
		// `useEditorState` subscribes through the editor's own emitter; these
		// counts never change during a test, so the subscription is inert.
		on: () => undefined,
		off: () => undefined,
		state: {},
	} as unknown as Editor
}

describe("EditorWordCount", () => {
	it("renders nothing before the editor exists", () => {
		const { container } = render(<EditorWordCount editor={null} />)

		expect(container).toBeEmptyDOMElement()
	})

	it("renders zero counts for an empty document", () => {
		render(<EditorWordCount editor={createTestEditor(0, 0)} />)

		expect(screen.getByText("0 words · 0 characters")).toBeTruthy()
	})

	it("uses singular nouns for a count of one", () => {
		render(<EditorWordCount editor={createTestEditor(1, 1)} />)

		expect(screen.getByText("1 word · 1 character")).toBeTruthy()
	})

	it("groups thousands in both counts", () => {
		render(<EditorWordCount editor={createTestEditor(1234, 6789)} />)

		expect(screen.getByText("1,234 words · 6,789 characters")).toBeTruthy()
	})
})
