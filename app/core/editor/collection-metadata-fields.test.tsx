import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Field } from "@/config/types"

import { MetadataField } from "./collection-metadata-fields"

function renderField(field: Field, value: unknown, disabled?: boolean) {
	const onChange = vi.fn()
	const { container } = render(
		<MetadataField
			field={field}
			value={value}
			onChange={onChange}
			disabled={disabled}
		/>,
	)
	return { container, onChange }
}

const publishedAt = {
	type: "datetime",
	label: "Published at",
} as unknown as Field

function renderDatetime(value: unknown) {
	const { container, onChange } = renderField(publishedAt, value)
	return {
		input: container.querySelector("input") as HTMLInputElement,
		onChange,
	}
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

const options = [
	{ label: "Rust", value: "rust" },
	{ label: "Go", value: "go" },
]

const language = {
	type: "select",
	label: "Language",
	options,
	placeholder: "Pick a language",
} as unknown as Field

const withEmptyOption = {
	type: "select",
	label: "Language",
	placeholder: "Pick a language",
	options: [{ label: "None", value: "" }, ...options],
} as unknown as Field

function trigger() {
	return screen.getByLabelText("Language")
}

/**
 * The stored value is the option's `value`; the writer only ever sees its
 * `label`. "No value" is `null` inside the control and `""` on the way out, so
 * a schema that declares an option whose value is `""` still gets a chosen
 * option rather than an empty one.
 */
describe("<MetadataField /> over a select", () => {
	it("does not fall back to a native select", () => {
		const { container } = renderField(language, "")
		expect(container.querySelector("select")).toBeNull()
		expect(trigger()).toBeInTheDocument()
	})

	it("shows the placeholder when nothing is chosen", () => {
		renderField(language, "")
		expect(trigger()).toHaveTextContent("Pick a language")
	})

	it("shows the option's label, not its stored value", () => {
		renderField(language, "rust")
		expect(trigger()).toHaveTextContent("Rust")
	})

	it("still shows a value the options no longer declare", () => {
		renderField(language, "elixir")
		expect(trigger()).toHaveTextContent("elixir")
	})

	it("reads a stored empty string as the option that declares it", () => {
		renderField(withEmptyOption, "")
		expect(trigger()).toHaveTextContent("None")
	})

	it("reads no value at all as nothing chosen, empty option or not", () => {
		renderField(withEmptyOption, undefined)
		expect(trigger()).toHaveTextContent("Pick a language")
	})

	it("emits the option's value when the writer picks one", async () => {
		const user = userEvent.setup()
		const { onChange } = renderField(language, "")

		await user.click(trigger())
		await user.click(await screen.findByRole("option", { name: "Go" }))

		expect(onChange).toHaveBeenCalledWith("go")
	})

	it("lets the writer put the field back to empty", async () => {
		const user = userEvent.setup()
		const { onChange } = renderField(language, "rust")

		await user.click(trigger())
		await user.click(
			await screen.findByRole("option", { name: "Pick a language" }),
		)

		expect(onChange).toHaveBeenCalledWith("")
	})

	it("is read-only when disabled", () => {
		renderField(language, "rust", true)
		expect(trigger()).toBeDisabled()
	})
})

const tags = {
	type: "multi_select",
	label: "Tags",
	options,
	placeholder: "Pick some tags",
} as unknown as Field

function chips(container: HTMLElement) {
	return Array.from(
		container.querySelectorAll<HTMLElement>('[data-slot="combobox-chip"]'),
	)
}

function removeButton(chip: HTMLElement) {
	return chip.querySelector(
		'[data-slot="combobox-chip-remove"]',
	) as HTMLButtonElement
}

/**
 * Each chosen value is its own removable token, so removing one leaves the rest
 * alone — the thing a native `multiple` list box could not do without a
 * ctrl-click.
 */
describe("<MetadataField /> over a multi_select", () => {
	it("shows one labelled token per chosen value", () => {
		const { container } = renderField(tags, ["rust", "go"])

		expect(container.querySelector("select")).toBeNull()
		expect(chips(container).map((chip) => chip.textContent)).toEqual([
			"Rust",
			"Go",
		])
	})

	it("shows the placeholder when nothing is chosen", () => {
		const { container } = renderField(tags, [])
		expect(chips(container)).toHaveLength(0)
		expect(screen.getByLabelText("Tags")).toHaveAttribute(
			"placeholder",
			"Pick some tags",
		)
	})

	it("still shows a value the options no longer declare", () => {
		const { container } = renderField(tags, ["rust", "elixir"])
		expect(chips(container).map((chip) => chip.textContent)).toEqual([
			"Rust",
			"elixir",
		])
	})

	it("removes one token without touching the others", async () => {
		const user = userEvent.setup()
		const { container, onChange } = renderField(tags, ["rust", "go"])

		await user.click(removeButton(chips(container)[0]))

		expect(onChange).toHaveBeenCalledWith(["go"])
	})

	it("keeps repeated values apart, token by token", async () => {
		const user = userEvent.setup()
		const { container, onChange } = renderField(tags, ["rust", "rust", "go"])

		expect(chips(container)).toHaveLength(3)
		await user.click(removeButton(chips(container)[0]))

		expect(onChange).toHaveBeenCalledWith(["rust", "go"])
	})

	it("filters the options by what the writer types", async () => {
		const user = userEvent.setup()
		renderField(tags, [])

		await user.click(screen.getByLabelText("Tags"))
		await user.type(screen.getByLabelText("Tags"), "ru")

		expect(
			(await screen.findAllByRole("option")).map((o) => o.textContent),
		).toEqual(["Rust"])
	})

	it("adds a chosen option to the values already held", async () => {
		const user = userEvent.setup()
		const { onChange } = renderField(tags, ["rust"])

		await user.click(screen.getByLabelText("Tags"))
		await user.click(await screen.findByRole("option", { name: "Go" }))

		expect(onChange).toHaveBeenCalledWith(["rust", "go"])
	})

	it("is read-only when disabled", async () => {
		const user = userEvent.setup()
		const { container, onChange } = renderField(tags, ["rust"], true)

		expect(screen.getByLabelText("Tags")).toBeDisabled()
		await user.click(removeButton(chips(container)[0]))

		expect(onChange).not.toHaveBeenCalled()
	})

	it("reaches the writer inside an array row", () => {
		const { container } = renderField(
			{
				type: "array",
				label: "Sections",
				items: [tags],
			} as unknown as Field,
			[["rust"]],
		)

		expect(chips(container).map((chip) => chip.textContent)).toEqual(["Rust"])
	})

	it("reaches the writer inside an object sub-field", () => {
		const { container } = renderField(
			{
				type: "object",
				label: "Meta",
				fields: { tags },
			} as unknown as Field,
			{ tags: ["go"] },
		)

		expect(chips(container).map((chip) => chip.textContent)).toEqual(["Go"])
	})
})

/**
 * ADR-0005 originally made a Managed Field static text. It was amended: the
 * system stamps these values, the writer may still correct them. The marker
 * only decides where the properties panel puts the control, never whether
 * there is one — so a Managed Field of any type keeps its ordinary control.
 */
describe("<MetadataField /> over a Managed Field", () => {
	it("renders the ordinary editable control for its type", () => {
		const { container, onChange } = renderField(
			{
				type: "datetime",
				label: "Created",
				managed: true,
			} as unknown as Field,
			"",
		)
		const input = container.querySelector("input") as HTMLInputElement

		expect(input.type).toBe("datetime-local")
		expect(input.disabled).toBe(false)
		expect(input.readOnly).toBe(false)

		fireEvent.change(input, { target: { value: "2026-07-14T09:30:00" } })
		expect(onChange).toHaveBeenCalled()
	})

	it("renders a managed select as a real select, not its raw value", () => {
		renderField(
			{
				type: "select",
				label: "Status",
				options: [
					{ label: "Draft", value: "draft" },
					{ label: "Published", value: "published" },
				],
				managed: true,
			} as unknown as Field,
			"draft",
		)

		const trigger = screen.getByRole("combobox")
		expect(trigger).toBeEnabled()
		expect(trigger).toHaveTextContent("Draft")
	})
})
