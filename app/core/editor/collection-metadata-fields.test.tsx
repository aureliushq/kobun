import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Field } from "@/config/types"

import { MetadataField } from "./collection-metadata-fields"

/**
 * The component itself decides nothing about a Field beyond its chrome, so
 * there is one thing to prove here: that the chrome is wired to the control the
 * dispatcher chose, both ways. Which control each Field Type gets, and what it
 * emits, is asserted at that seam in `app/core/fields/control.test.tsx`.
 */
describe("<MetadataField />", () => {
	it("names the Field above the control the dispatcher chose", () => {
		const onChange = vi.fn()
		const { container } = render(
			<MetadataField
				field={
					{
						type: "text",
						label: "Title",
						description: "Heads the page",
						required: true,
					} as unknown as Field
				}
				value="Hello"
				onChange={onChange}
			/>,
		)

		expect(screen.getByText("Title *")).toBeInTheDocument()
		expect(screen.getByText("Heads the page")).toBeInTheDocument()

		const input = container.querySelector("input") as HTMLInputElement
		expect(input.value).toBe("Hello")

		fireEvent.change(input, { target: { value: "Goodbye" } })
		expect(onChange).toHaveBeenCalledWith("Goodbye")
	})
})
