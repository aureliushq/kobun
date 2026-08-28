import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Field } from "@/config/types"

import { MetadataField } from "./collection-metadata-fields"

const publishedAt = {
	type: "datetime",
	label: "Published at",
} as unknown as Field

function renderDatetime(value: unknown) {
	const onChange = vi.fn()
	const { container } = render(
		<MetadataField field={publishedAt} value={value} onChange={onChange} />,
	)
	const input = container.querySelector("input") as HTMLInputElement
	return { input, onChange }
}

/**
 * The stored value is a UTC instant; the control speaks the writer's local wall
 * time. Both directions are asserted against a local-time round trip rather
 * than a hardcoded offset, so the test says the same thing in every timezone.
 */
describe("<MetadataField /> over a datetime", () => {
	it("uses a date-and-time control, not a plain text input", () => {
		expect(renderDatetime("").input.type).toBe("datetime-local")
	})

	it("shows a stored UTC instant as local wall time, seconds included", () => {
		const instant = "2026-07-14T09:30:45.000Z"
		const local = new Date(instant)
		const pad = (part: number) => String(part).padStart(2, "0")

		expect(renderDatetime(instant).input.value).toBe(
			`${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(
				local.getDate(),
			)}T${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(
				local.getSeconds(),
			)}`,
		)
	})

	it("keeps the seconds a stamped value carries", () => {
		const { input, onChange } = renderDatetime("2026-07-14T09:30:45.000Z")

		fireEvent.change(input, { target: { value: "2026-07-14T11:15:45" } })

		expect(onChange).toHaveBeenCalledWith(
			new Date("2026-07-14T11:15:45").toISOString(),
		)
		expect(onChange.mock.calls[0][0]).toContain(":45.")
	})

	it("emits a UTC instant when the writer picks a local time", () => {
		const { input, onChange } = renderDatetime("")

		fireEvent.change(input, { target: { value: "2026-07-14T09:30" } })

		expect(onChange).toHaveBeenCalledWith(
			new Date("2026-07-14T09:30").toISOString(),
		)
	})

	it("emits an empty value when the writer clears the control", () => {
		const { input, onChange } = renderDatetime("2026-07-14T09:30:00.000Z")

		fireEvent.change(input, { target: { value: "" } })

		expect(onChange).toHaveBeenCalledWith("")
	})

	it("shows an empty control for a value it cannot parse", () => {
		expect(renderDatetime("not a datetime").input.value).toBe("")
	})
})
