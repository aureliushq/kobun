import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Field } from "@/config/types"

import { renderFieldControl } from "./dispatch"
import type { ControlContext } from "./types"

/**
 * What the edit side of the field dispatcher renders.
 *
 * Written as characterization tests against the chain these entries replace,
 * which is why they read as a description of the properties sidebar rather than
 * of the registry: they pass before the chain dissolves and after, and anything
 * that stops passing is a behavior change nobody asked for.
 *
 * They assert through the seam only — a Field, a value and a control context
 * in, DOM and emitted values out — and never reach for an entry. What the
 * writer types into, and what comes back when they do, is the whole contract.
 */

/** Schema literals are authored, not parsed, so the enum discriminants are cast. */
function field(declaration: Record<string, unknown>): Field {
	return declaration as unknown as Field
}

/**
 * A control, its change spy, and the defaulting it was handed. The default is a
 * stub rather than the real one: what a Field defaults to is settled at another
 * seam, and an array only has to hand back whatever it was given.
 */
function control(
	declaration: Record<string, unknown>,
	value: unknown,
	overrides: Partial<ControlContext> = {},
) {
	const onChange = vi.fn()
	const defaultForField = vi.fn(() => "")
	const view = render(
		renderFieldControl(field(declaration), value, {
			defaultForField,
			onChange,
			...overrides,
		}),
	)
	return { ...view, defaultForField, onChange }
}

function input(container: HTMLElement) {
	return container.querySelector("input") as HTMLInputElement
}

////////////////////// TEXT-SHAPED SCALARS //////////////////////

describe("the control over a text-shaped Scalar", () => {
	it("gives text a single-line input carrying its placeholder", () => {
		const { container, onChange } = control(
			{ type: "text", label: "Title", placeholder: "Name it" },
			"Hello",
		)
		const control_ = input(container)

		expect(control_.type).toBe("text")
		expect(control_.value).toBe("Hello")
		expect(control_.placeholder).toBe("Name it")

		fireEvent.change(control_, { target: { value: "Goodbye" } })
		expect(onChange).toHaveBeenCalledWith("Goodbye")
	})

	it("gives a multiline text a textarea instead", () => {
		const { container, onChange } = control(
			{ type: "text", label: "Bio", multiline: true, placeholder: "About you" },
			"a\nb",
		)
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement

		expect(container.querySelector("input")).toBeNull()
		expect(textarea.value).toBe("a\nb")
		expect(textarea.placeholder).toBe("About you")

		fireEvent.change(textarea, { target: { value: "c" } })
		expect(onChange).toHaveBeenCalledWith("c")
	})

	it("gives a date a date picker", () => {
		const { container, onChange } = control(
			{ type: "date", label: "Published" },
			"2020-01-01",
		)

		expect(input(container).type).toBe("date")
		expect(input(container).value).toBe("2020-01-01")

		fireEvent.change(input(container), { target: { value: "2021-02-03" } })
		expect(onChange).toHaveBeenCalledWith("2021-02-03")
	})

	it("gives a url a url input carrying its placeholder", () => {
		const { container } = control(
			{ type: "url", label: "Site", placeholder: "https://" },
			"https://kobun.io",
		)

		expect(input(container).type).toBe("url")
		expect(input(container).placeholder).toBe("https://")
	})

	it("gives a Slug a plain text input", () => {
		const { container, onChange } = control(
			{ type: "slug", label: "Slug", from: "title" },
			"my-post",
		)

		expect(input(container).type).toBe("text")
		expect(input(container).value).toBe("my-post")

		fireEvent.change(input(container), { target: { value: "other-post" } })
		expect(onChange).toHaveBeenCalledWith("other-post")
	})

	it("shows an empty input for a value nobody filled in", () => {
		expect(
			input(control({ type: "text", label: "Title" }, null).container).value,
		).toBe("")
		expect(
			input(control({ type: "text", label: "Title" }, undefined).container)
				.value,
		).toBe("")
	})

	it("locks every text-shaped control while the form is busy", () => {
		expect(
			input(
				control({ type: "text", label: "Title" }, "", { disabled: true })
					.container,
			).disabled,
		).toBe(true)
	})
})

////////////////////// DATETIME //////////////////////

/**
 * The stored value is a UTC instant; the control speaks the writer's local wall
 * time. Both directions are asserted against a local-time round trip rather
 * than a hardcoded offset, so the test says the same thing in every timezone.
 */
describe("the control over a datetime", () => {
	function datetime(value: unknown) {
		const view = control({ type: "datetime", label: "Published at" }, value)
		return { input: input(view.container), onChange: view.onChange }
	}

	it("uses a date-and-time control, not a plain text input", () => {
		expect(datetime("").input.type).toBe("datetime-local")
	})

	it("shows a stored UTC instant as local wall time, seconds included", () => {
		const instant = "2026-07-14T09:30:45.000Z"
		const local = new Date(instant)
		const pad = (part: number) => String(part).padStart(2, "0")

		expect(datetime(instant).input.value).toBe(
			`${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(
				local.getDate(),
			)}T${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(
				local.getSeconds(),
			)}`,
		)
	})

	it("keeps the seconds a stamped value carries", () => {
		const { input: control_, onChange } = datetime("2026-07-14T09:30:45.000Z")

		fireEvent.change(control_, { target: { value: "2026-07-14T11:15:45" } })

		expect(onChange).toHaveBeenCalledWith(
			new Date("2026-07-14T11:15:45").toISOString(),
		)
		expect(onChange.mock.calls[0][0]).toContain(":45.")
	})

	it("emits a UTC instant when the writer picks a local time", () => {
		const { input: control_, onChange } = datetime("")

		fireEvent.change(control_, { target: { value: "2026-07-14T09:30" } })

		expect(onChange).toHaveBeenCalledWith(
			new Date("2026-07-14T09:30").toISOString(),
		)
	})

	it("emits an empty value when the writer clears the control", () => {
		const { input: control_, onChange } = datetime("2026-07-14T09:30:00.000Z")

		fireEvent.change(control_, { target: { value: "" } })

		expect(onChange).toHaveBeenCalledWith("")
	})

	it("shows an empty control for a value it cannot parse", () => {
		expect(datetime("not a datetime").input.value).toBe("")
	})
})

////////////////////// IMAGE //////////////////////

describe("the control over an image", () => {
	const image = { type: "image", label: "Cover" }

	it("takes a repository path as text, with no preview until there is one", () => {
		const { container } = control(image, "")

		expect(input(container).type).toBe("text")
		expect(container.querySelector("img")).toBeNull()
	})

	it("previews a repository path against the asset base, segment by segment", () => {
		const { container } = control(image, "images/my cover.png", {
			assetBaseUrl: "/api/repo-asset/acme/site",
		})

		expect(container.querySelector("img")?.getAttribute("src")).toBe(
			"/api/repo-asset/acme/site/images/my%20cover.png",
		)
	})

	it("leaves a source that already stands on its own alone", () => {
		const assetBaseUrl = "/api/repo-asset/acme/site"
		const untouched = [
			"https://cdn.example.com/a.png",
			"data:image/png;base64,AAAA",
			"/uploads/a.png",
		]

		for (const value of untouched) {
			const { container } = control(image, value, { assetBaseUrl })
			expect(container.querySelector("img")?.getAttribute("src")).toBe(value)
		}
	})

	it("shows the path as-is when there is no asset base to resolve against", () => {
		const { container } = control(image, "images/a.png")
		expect(container.querySelector("img")?.getAttribute("src")).toBe(
			"images/a.png",
		)
	})
})

////////////////////// BOOLEAN //////////////////////

describe("the control over a boolean", () => {
	it("is a checkbox by default, and emits a boolean either way", () => {
		const { container, onChange } = control(
			{ type: "boolean", label: "Draft" },
			false,
		)
		const checkbox = container.querySelector(
			'[data-slot="checkbox"]',
		) as HTMLElement

		expect(checkbox).not.toBeNull()
		expect(container.querySelector('[data-slot="switch"]')).toBeNull()

		fireEvent.click(checkbox)
		expect(onChange).toHaveBeenCalledWith(true)
	})

	it("is a switch when the schema asks for one", () => {
		const { container, onChange } = control(
			{ type: "boolean", label: "Draft", componentType: "switch" },
			false,
		)
		const toggle = container.querySelector(
			'[data-slot="switch"]',
		) as HTMLElement

		expect(toggle).not.toBeNull()
		expect(container.querySelector('[data-slot="checkbox"]')).toBeNull()

		fireEvent.click(toggle)
		// The Switch hands its change straight to `onChange`, so Base UI's event
		// details ride along as a second argument. Only the first is the value.
		expect(onChange.mock.calls[0][0]).toBe(true)
	})

	it("treats anything that is not true as unchecked", () => {
		const { container } = control({ type: "boolean", label: "Draft" }, null)
		expect(
			container.querySelector('[data-slot="checkbox"]'),
		).not.toHaveAttribute("data-checked")
	})
})

////////////////////// CHOICES //////////////////////

const OPTIONS = [
	{ label: "Draft", value: "draft" },
	{ label: "Live", value: "live" },
]

describe("the control over a select", () => {
	it("offers one choice at a time, above a placeholder option", () => {
		const { container, onChange } = control(
			{ type: "select", label: "Status", options: OPTIONS },
			"live",
		)
		const select = container.querySelector("select") as HTMLSelectElement

		expect(select.multiple).toBe(false)
		expect(select.value).toBe("live")
		expect([...select.options].map((option) => option.textContent)).toEqual([
			"Select…",
			"Draft",
			"Live",
		])

		fireEvent.change(select, { target: { value: "draft" } })
		expect(onChange).toHaveBeenCalledWith("draft")
	})

	it("uses the schema's placeholder for the empty choice when it has one", () => {
		const { container } = control(
			{
				type: "select",
				label: "Status",
				options: OPTIONS,
				placeholder: "Pick one",
			},
			"",
		)
		expect(
			(container.querySelector("select") as HTMLSelectElement).options[0]
				.textContent,
		).toBe("Pick one")
	})
})

describe("the control over a multi_select", () => {
	it("shows every stored choice as selected at once", () => {
		const { container } = control(
			{ type: "multi_select", label: "Tags", options: OPTIONS },
			["draft", "live"],
		)
		const select = container.querySelector("select") as HTMLSelectElement

		expect(select.multiple).toBe(true)
		expect([...select.selectedOptions].map((option) => option.value)).toEqual([
			"draft",
			"live",
		])
	})

	it("emits a list of what is selected, not a single value", async () => {
		const { onChange } = control(
			{ type: "multi_select", label: "Tags", options: OPTIONS },
			[],
		)

		await userEvent.selectOptions(screen.getByRole("listbox"), "live")

		expect(onChange).toHaveBeenLastCalledWith(["live"])
	})

	it("selects nothing for a value that is not a list", () => {
		const { container } = control(
			{ type: "multi_select", label: "Tags", options: OPTIONS },
			"draft",
		)
		expect(
			(container.querySelector("select") as HTMLSelectElement).selectedOptions
				.length,
		).toBe(0)
	})
})

////////////////////// OBJECT //////////////////////

const author = {
	type: "object",
	label: "Author",
	fields: {
		name: { type: "text", label: "Name", required: true },
		url: { type: "url", label: "Site", description: "Where they write" },
	},
}

describe("the control over an object", () => {
	it("gives every child its own labelled control", () => {
		const { container } = control(author, { name: "Grace", url: "" })

		expect(screen.getByText("Name *")).toBeInTheDocument()
		expect(screen.getByText("Site")).toBeInTheDocument()
		expect(screen.getByText("Where they write")).toBeInTheDocument()
		expect(container.querySelectorAll("input")).toHaveLength(2)
	})

	it("emits the whole record when one child changes", () => {
		const { container, onChange } = control(author, {
			name: "Grace",
			url: "https://kobun.io",
		})

		fireEvent.change(container.querySelectorAll("input")[0], {
			target: { value: "Ada" },
		})

		expect(onChange).toHaveBeenCalledWith({
			name: "Ada",
			url: "https://kobun.io",
		})
	})

	it("treats a value that is not a record as an empty one", () => {
		const { container, onChange } = control(author, "not a record")

		expect(container.querySelectorAll("input")[0].value).toBe("")

		fireEvent.change(container.querySelectorAll("input")[0], {
			target: { value: "Ada" },
		})
		expect(onChange).toHaveBeenCalledWith({ name: "Ada" })
	})
})

////////////////////// ARRAY //////////////////////

const links = {
	type: "array",
	label: "Links",
	itemLabel: "link",
	items: [{ type: "text", label: "Link" }],
}

const people = {
	type: "array",
	label: "People",
	items: [
		{ type: "text", label: "Name" },
		{ type: "url", label: "Site" },
	],
}

function buttonsNamed(name: string) {
	return screen.getAllByRole("button", { name })
}

describe("the control over an array of single-item rows", () => {
	it("gives each row one control, and changes only the row that changed", () => {
		const { container, onChange } = control(links, ["a", "b"])

		expect(container.querySelectorAll("input")).toHaveLength(2)

		fireEvent.change(container.querySelectorAll("input")[1], {
			target: { value: "c" },
		})
		expect(onChange).toHaveBeenCalledWith(["a", "c"])
	})

	it("appends a row built by the defaulting it was handed", () => {
		const { defaultForField, onChange } = control(links, ["a"])

		fireEvent.click(screen.getByRole("button", { name: "Add link" }))

		expect(defaultForField).toHaveBeenCalledWith(links.items[0])
		expect(onChange).toHaveBeenCalledWith(["a", ""])
	})

	it("calls a row an item when the schema does not name one", () => {
		control({ ...links, itemLabel: undefined }, [])
		expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument()
	})

	it("moves a row up, down, and out", () => {
		const { onChange } = control(links, ["a", "b", "c"])

		fireEvent.click(buttonsNamed("Up")[1])
		expect(onChange).toHaveBeenLastCalledWith(["b", "a", "c"])

		fireEvent.click(buttonsNamed("Down")[0])
		expect(onChange).toHaveBeenLastCalledWith(["b", "a", "c"])

		fireEvent.click(buttonsNamed("Remove")[1])
		expect(onChange).toHaveBeenLastCalledWith(["a", "c"])
	})

	it("has nowhere to move the first row up or the last row down", () => {
		control(links, ["a", "b"])

		expect(buttonsNamed("Up")[0]).toBeDisabled()
		expect(buttonsNamed("Up")[1]).not.toBeDisabled()
		expect(buttonsNamed("Down")[0]).not.toBeDisabled()
		expect(buttonsNamed("Down")[1]).toBeDisabled()
	})

	it("locks every row control and the add button while the form is busy", () => {
		control(links, ["a", "b"], { disabled: true })

		for (const name of ["Up", "Down", "Remove"]) {
			for (const button of buttonsNamed(name)) expect(button).toBeDisabled()
		}
		expect(screen.getByRole("button", { name: "Add link" })).toBeDisabled()
	})
})

describe("the control over an array of composite rows", () => {
	it("reads a tuple row by position and writes a tuple back", () => {
		const { container, onChange } = control(people, [
			["Grace", "https://kobun.io"],
		])

		expect(
			[...container.querySelectorAll("input")].map((i) => i.value),
		).toEqual(["Grace", "https://kobun.io"])

		fireEvent.change(container.querySelectorAll("input")[0], {
			target: { value: "Ada" },
		})
		expect(onChange).toHaveBeenCalledWith([["Ada", "https://kobun.io"]])
	})

	it("reads a record row by label and writes a record back", () => {
		const { container, onChange } = control(people, [
			{ Name: "Grace", Site: "https://kobun.io" },
		])

		expect(container.querySelectorAll("input")[0].value).toBe("Grace")

		fireEvent.change(container.querySelectorAll("input")[1], {
			target: { value: "https://example.com" },
		})
		expect(onChange).toHaveBeenCalledWith([
			{ Name: "Grace", Site: "https://example.com" },
		])
	})

	it("appends a row with one default per declared item", () => {
		const { onChange } = control(people, [])

		fireEvent.click(screen.getByRole("button", { name: "Add item" }))

		expect(onChange).toHaveBeenCalledWith([["", ""]])
	})

	it("labels each item of a row", () => {
		control(people, [["Grace", ""]])

		expect(screen.getByText("Name")).toBeInTheDocument()
		expect(screen.getByText("Site")).toBeInTheDocument()
	})
})

////////////////////// THE DOCUMENT ROLE //////////////////////

describe("a Document reaching the control dispatcher", () => {
	it("is refused, not edited — the Body belongs to the editor", () => {
		expect(() =>
			control({ type: "document", label: "Content" }, "# Hello"),
		).toThrow(/Document Role/)
	})

	it("is refused just as loudly nested inside a Container", () => {
		expect(() =>
			control(
				{
					type: "object",
					label: "Author",
					fields: { bio: { type: "document", label: "Bio" } },
				},
				{},
			),
		).toThrow(/Document Role/)
	})
})
