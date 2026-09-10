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
		const textbox = input(container)

		expect(textbox.type).toBe("text")
		expect(textbox.value).toBe("Hello")
		expect(textbox.placeholder).toBe("Name it")

		fireEvent.change(textbox, { target: { value: "Goodbye" } })
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

	it("gives a Slug a plain text input the writer can overrule", () => {
		const { container, onChange } = control(
			{ type: "slug", label: "Slug", from: "title", placeholder: "my-post" },
			"a-post",
		)

		expect(input(container).type).toBe("text")
		expect(input(container).value).toBe("a-post")
		expect(input(container).placeholder).toBe("my-post")

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

	// The control reads and writes wall time, so which clock that is decides
	// which instant gets committed. Nothing on screen says, so the control does.
	it("names the clock its wall time is read on", () => {
		expect(datetime("").input.title).toBe(
			`Read and written on the ${Intl.DateTimeFormat().resolvedOptions().timeZone} clock.`,
		)
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
		const { input: picker, onChange } = datetime("2026-07-14T09:30:45.000Z")

		fireEvent.change(picker, { target: { value: "2026-07-14T11:15:45" } })

		expect(onChange).toHaveBeenCalledWith(
			new Date("2026-07-14T11:15:45").toISOString(),
		)
		expect(onChange.mock.calls[0][0]).toContain(":45.")
	})

	it("emits a UTC instant when the writer picks a local time", () => {
		const { input: picker, onChange } = datetime("")

		fireEvent.change(picker, { target: { value: "2026-07-14T09:30" } })

		expect(onChange).toHaveBeenCalledWith(
			new Date("2026-07-14T09:30").toISOString(),
		)
	})

	it("emits an empty value when the writer clears the control", () => {
		const { input: picker, onChange } = datetime("2026-07-14T09:30:00.000Z")

		fireEvent.change(picker, { target: { value: "" } })

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

const status = {
	type: "select",
	label: "Status",
	options: OPTIONS,
	placeholder: "Pick a state",
}

const withEmptyOption = {
	type: "select",
	label: "Status",
	placeholder: "Pick a state",
	options: [{ label: "None", value: "" }, ...OPTIONS],
}

function trigger(label: string) {
	return screen.getByLabelText(label)
}

/**
 * The stored value is the option's `value`; the writer only ever sees its
 * `label`. "No value" is `null` inside the control and `""` on the way out, so
 * a schema that declares an option whose value is `""` still gets a chosen
 * option rather than an empty one.
 */
describe("the control over a select", () => {
	it("does not fall back to a native select", () => {
		const { container } = control(status, "")

		expect(container.querySelector("select")).toBeNull()
		expect(trigger("Status")).toBeInTheDocument()
	})

	it("shows the placeholder when nothing is chosen", () => {
		control(status, "")
		expect(trigger("Status")).toHaveTextContent("Pick a state")
	})

	it("falls back to its own placeholder when the schema has none", () => {
		control({ type: "select", label: "Status", options: OPTIONS }, "")
		expect(trigger("Status")).toHaveTextContent("Select…")
	})

	it("shows the option's label, not its stored value", () => {
		control(status, "live")
		expect(trigger("Status")).toHaveTextContent("Live")
	})

	it("still shows a value the options no longer declare", () => {
		control(status, "archived")
		expect(trigger("Status")).toHaveTextContent("archived")
	})

	it("reads a stored empty string as the option that declares it", () => {
		control(withEmptyOption, "")
		expect(trigger("Status")).toHaveTextContent("None")
	})

	it("reads no value at all as nothing chosen, empty option or not", () => {
		control(withEmptyOption, undefined)
		expect(trigger("Status")).toHaveTextContent("Pick a state")
	})

	it("emits the option's value when the writer picks one", async () => {
		const user = userEvent.setup()
		const { onChange } = control(status, "")

		await user.click(trigger("Status"))
		await user.click(await screen.findByRole("option", { name: "Live" }))

		expect(onChange).toHaveBeenCalledWith("live")
	})

	it("lets the writer put the field back to empty", async () => {
		const user = userEvent.setup()
		const { onChange } = control(status, "live")

		await user.click(trigger("Status"))
		await user.click(
			await screen.findByRole("option", { name: "Pick a state" }),
		)

		expect(onChange).toHaveBeenCalledWith("")
	})

	it("is read-only when disabled", () => {
		control(status, "live", { disabled: true })
		expect(trigger("Status")).toBeDisabled()
	})
})

const tags = {
	type: "multi_select",
	label: "Tags",
	options: OPTIONS,
	placeholder: "Pick some tags",
}

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
describe("the control over a multi_select", () => {
	it("shows one labelled token per chosen value", () => {
		const { container } = control(tags, ["draft", "live"])

		expect(container.querySelector("select")).toBeNull()
		expect(chips(container).map((chip) => chip.textContent)).toEqual([
			"Draft",
			"Live",
		])
	})

	it("shows the placeholder when nothing is chosen", () => {
		const { container } = control(tags, [])

		expect(chips(container)).toHaveLength(0)
		expect(trigger("Tags")).toHaveAttribute("placeholder", "Pick some tags")
	})

	it("still shows a value the options no longer declare", () => {
		const { container } = control(tags, ["draft", "archived"])
		expect(chips(container).map((chip) => chip.textContent)).toEqual([
			"Draft",
			"archived",
		])
	})

	it("shows no tokens for a value that is not a list", () => {
		const { container } = control(tags, "draft")
		expect(chips(container)).toHaveLength(0)
	})

	it("removes one token without touching the others", async () => {
		const user = userEvent.setup()
		const { container, onChange } = control(tags, ["draft", "live"])

		await user.click(removeButton(chips(container)[0]))

		expect(onChange).toHaveBeenCalledWith(["live"])
	})

	it("keeps repeated values apart, token by token", async () => {
		const user = userEvent.setup()
		const { container, onChange } = control(tags, ["draft", "draft", "live"])

		expect(chips(container)).toHaveLength(3)
		await user.click(removeButton(chips(container)[0]))

		expect(onChange).toHaveBeenCalledWith(["draft", "live"])
	})

	it("filters the options by what the writer types", async () => {
		const user = userEvent.setup()
		control(tags, [])

		await user.click(trigger("Tags"))
		await user.type(trigger("Tags"), "li")

		expect(
			(await screen.findAllByRole("option")).map((one) => one.textContent),
		).toEqual(["Live"])
	})

	it("adds a chosen option to the values already held", async () => {
		const user = userEvent.setup()
		const { onChange } = control(tags, ["draft"])

		await user.click(trigger("Tags"))
		await user.click(await screen.findByRole("option", { name: "Live" }))

		expect(onChange).toHaveBeenCalledWith(["draft", "live"])
	})

	it("is read-only when disabled", async () => {
		const user = userEvent.setup()
		const { container, onChange } = control(tags, ["draft"], {
			disabled: true,
		})

		expect(trigger("Tags")).toBeDisabled()
		await user.click(removeButton(chips(container)[0]))

		expect(onChange).not.toHaveBeenCalled()
	})

	it("reaches the writer inside an array row", () => {
		const { container } = control(
			{ type: "array", label: "Sections", items: [tags] },
			[["draft"]],
		)

		expect(chips(container).map((chip) => chip.textContent)).toEqual(["Draft"])
	})

	it("reaches the writer inside an object sub-field", () => {
		const { container } = control(
			{ type: "object", label: "Meta", fields: { tags } },
			{ tags: ["live"] },
		)

		expect(chips(container).map((chip) => chip.textContent)).toEqual(["Live"])
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

////////////////////// MANAGED FIELDS //////////////////////

/**
 * ADR-0005 originally made a Managed Field static text. It was amended: the
 * system stamps these values, the writer may still correct them. The marker
 * only decides where the properties panel puts the control, never whether there
 * is one — so a Managed Field of any type keeps its ordinary control, and the
 * marker never reaches the dispatch as a branch.
 */
describe("a Managed Field reaching the control dispatcher", () => {
	it("gets the ordinary editable control for its type", () => {
		const { container, onChange } = control(
			{ type: "datetime", label: "Created", managed: true },
			"",
		)
		const field = input(container)

		expect(field.type).toBe("datetime-local")
		expect(field.disabled).toBe(false)
		expect(field.readOnly).toBe(false)

		fireEvent.change(field, { target: { value: "2026-07-14T09:30:00" } })
		expect(onChange).toHaveBeenCalled()
	})

	it("gets a real select for a managed status, not its raw value", () => {
		control({ ...status, label: "Status", managed: true }, "draft")

		expect(trigger("Status")).toBeEnabled()
		expect(trigger("Status")).toHaveTextContent("Draft")
	})
})
