import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { CollectionTitleField } from "./collection-title-field"

function renderField(
	overrides: Partial<Parameters<typeof CollectionTitleField>[0]> = {},
) {
	const onChange = vi.fn()
	const onCommit = vi.fn()
	render(
		<CollectionTitleField
			onChange={onChange}
			onCommit={onCommit}
			value=""
			{...overrides}
		/>,
	)
	const field = screen.getByLabelText("Title") as HTMLTextAreaElement
	return { field, onChange, onCommit }
}

describe("<CollectionTitleField />", () => {
	it("takes focus on mount with the caret after existing text", () => {
		const { field } = renderField({ value: "An existing title" })

		expect(field).toHaveFocus()
		expect(field.selectionStart).toBe("An existing title".length)
		expect(field.selectionEnd).toBe("An existing title".length)
	})

	it("falls back to a placeholder when the schema names none", () => {
		expect(renderField().field).toHaveAttribute("placeholder", "Untitled")
	})

	it("prefers the placeholder the schema names", () => {
		expect(renderField({ placeholder: "Post title" }).field).toHaveAttribute(
			"placeholder",
			"Post title",
		)
	})

	it("commits on Enter instead of inserting a newline", async () => {
		const user = userEvent.setup()
		const { field, onChange, onCommit } = renderField({ value: "Title" })

		await user.type(field, "{Enter}")

		expect(onCommit).toHaveBeenCalledTimes(1)
		expect(onChange).not.toHaveBeenCalled()
	})

	it("collapses pasted newlines so the value stays single-line", async () => {
		const user = userEvent.setup()
		const { onChange } = renderField()

		// The field is already focused on mount, so this pastes into it.
		await user.paste("first\nsecond\r\nthird")

		expect(onChange).toHaveBeenCalledWith("first second third")
	})
})
