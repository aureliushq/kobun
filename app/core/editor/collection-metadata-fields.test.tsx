import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Field } from "@/config/types"

import { MetadataField } from "./collection-metadata-fields"

/**
 * The component itself decides nothing about a Field beyond its chrome, so
 * there are two things to prove here: that the chrome is wired to the control
 * the dispatcher chose, both ways, and that the Role rules it hands down reach a
 * nested Slug. Which control each Field Type gets, and what it emits, is
 * asserted at that seam in `app/core/fields/control.test.tsx`.
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

	describe("a Slug nested in an object", () => {
		const profile = {
			type: "object",
			label: "Profile",
			fields: {
				name: { type: "text", label: "Name" },
				handle: { type: "slug", label: "Handle", from: "name" },
			},
		}

		function edit(
			field: unknown,
			value: unknown,
			inputIndex: number,
			next: string,
		) {
			const onChange = vi.fn()
			const { container } = render(
				<MetadataField
					field={field as Field}
					value={value}
					onChange={onChange}
				/>,
			)
			fireEvent.change(container.querySelectorAll("input")[inputIndex], {
				target: { value: next },
			})
			return onChange
		}

		it("follows its source Field as the writer types", () => {
			expect(
				edit(profile, { name: "Ada", handle: "ada" }, 0, "Ada Lovelace"),
			).toHaveBeenCalledWith({ name: "Ada Lovelace", handle: "ada-lovelace" })
		})

		it("stops following once the writer has typed over it", () => {
			expect(
				edit(profile, { name: "Ada", handle: "countess" }, 0, "Ada Lovelace"),
			).toHaveBeenCalledWith({ name: "Ada Lovelace", handle: "countess" })
		})

		it("follows its own row's source in an array of objects", () => {
			const people = { type: "array", label: "People", items: [profile] }

			expect(
				edit(
					people,
					[
						{ name: "Ada", handle: "ada" },
						{ name: "", handle: "" },
					],
					2,
					"Grace Hopper",
				),
			).toHaveBeenCalledWith([
				{ name: "Ada", handle: "ada" },
				{ name: "Grace Hopper", handle: "grace-hopper" },
			])
		})
	})
})
