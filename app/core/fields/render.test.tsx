import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import type { Field } from "@/config/types"

import { renderFieldInline, renderFieldValue } from "./dispatch"
import type { RenderContext } from "./types"

/**
 * Characterization tests for the read side of the field dispatcher.
 *
 * They say what a content editor sees today, so that #71 can dissolve the two
 * switches into registry entries and prove the page did not change. They assert
 * through the seam only — a Field, a value and a render context in; DOM out —
 * and never reach for an entry.
 */

/** Schema literals are authored, not parsed, so the enum discriminants are cast. */
function field(declaration: Record<string, unknown>): Field {
	return declaration as unknown as Field
}

const EDITOR_PATH = "/acme/site/singletons/home/editor"

function context(overrides: Partial<RenderContext> = {}): RenderContext {
	return {
		accordionDepth: 0,
		depth: 0,
		name: "site",
		owner: "acme",
		...overrides,
	}
}

function rich(
	declaration: Record<string, unknown>,
	value: unknown,
	overrides: Partial<RenderContext> = {},
) {
	return render(
		<MemoryRouter>
			{renderFieldValue(field(declaration), value, context(overrides))}
		</MemoryRouter>,
	)
}

function inline(declaration: Record<string, unknown>, value: unknown) {
	return render(
		<MemoryRouter>{renderFieldInline(field(declaration), value)}</MemoryRouter>,
	)
}

////////////////////// SCALARS, RICH //////////////////////

describe("the rich panel over a Scalar", () => {
	it("shows text on one line, and a multiline text as a paragraph", () => {
		expect(
			rich({ type: "text", label: "Title" }, "Hello").container.innerHTML,
		).toBe("<span>Hello</span>")

		expect(
			rich({ type: "text", label: "Bio", multiline: true }, "a\nb").container
				.innerHTML,
		).toBe('<p class="whitespace-pre-wrap">a\nb</p>')
	})

	it("shows a Slug as a code chip", () => {
		const { container } = rich(
			{ type: "slug", label: "Slug", from: "title" },
			"my-post",
		)
		const code = container.querySelector("code")
		expect(code).toHaveTextContent("my-post")
		expect(code?.className).toContain("font-mono")
	})

	it("shows a url as a new-tab link to itself", () => {
		const { container } = rich(
			{ type: "url", label: "Site" },
			"https://kobun.io",
		)
		const anchor = container.querySelector("a") as HTMLAnchorElement
		expect(anchor).toHaveTextContent("https://kobun.io")
		expect(anchor.href).toBe("https://kobun.io/")
		expect(anchor.target).toBe("_blank")
		expect(anchor.rel).toBe("noreferrer")
	})

	it("shows a date as a distance from now, keeping the raw value as its title", () => {
		const { container } = rich(
			{ type: "date", label: "Published" },
			"2020-01-01",
		)
		const span = container.querySelector("span") as HTMLSpanElement
		expect(span.title).toBe("2020-01-01")
		expect(span.textContent).toContain("ago")
	})

	it("shows a datetime as a wall-clock stamp, not a distance", () => {
		const instant = "2026-07-14T09:30:00.000Z"
		const { container } = rich(
			{ type: "datetime", label: "Published at" },
			instant,
		)
		const span = container.querySelector("span") as HTMLSpanElement
		expect(span.title).toBe(instant)
		expect(span.textContent).toMatch(/^Jul 14, 2026, \d{1,2}:\d{2} (AM|PM)$/)
	})

	it("says so when a date or datetime cannot be parsed", () => {
		expect(
			rich({ type: "date", label: "Published" }, "nope").container,
		).toHaveTextContent("invalid date")
		expect(
			rich({ type: "datetime", label: "Published at" }, "nope").container,
		).toHaveTextContent("invalid date")
	})

	it("shows a boolean as a badge either way", () => {
		expect(
			rich({ type: "boolean", label: "Draft" }, true).container,
		).toHaveTextContent("true")
		expect(
			rich({ type: "boolean", label: "Draft" }, false).container,
		).toHaveTextContent("false")
		// A stringified flag reads the same as the real one.
		expect(
			rich({ type: "boolean", label: "Draft" }, "true").container,
		).toHaveTextContent("true")
	})

	it("serves a repository image through the asset route, and an absolute one as-is", () => {
		const repo = rich(
			{ type: "image", label: "Cover" },
			"assets/cover photo.png",
		)
		expect(repo.container.querySelector("img")).toHaveAttribute(
			"src",
			"/api/repo-asset/acme/site/assets/cover%20photo.png",
		)
		expect(repo.container).toHaveTextContent("assets/cover photo.png")

		const absolute = rich(
			{ type: "image", label: "Cover" },
			"https://cdn.io/a.png",
		)
		expect(absolute.container.querySelector("img")).toHaveAttribute(
			"src",
			"https://cdn.io/a.png",
		)
	})

	it("shows a select as its option's label, falling back to the stored value", () => {
		const declaration = {
			type: "select",
			label: "Status",
			options: [{ label: "Published", value: "published" }],
		}
		expect(rich(declaration, "published").container).toHaveTextContent(
			"Published",
		)
		expect(rich(declaration, "retired").container).toHaveTextContent("retired")
	})

	it("shows a multi_select as one badge per choice", () => {
		const declaration = {
			type: "multi_select",
			label: "Tags",
			options: [
				{ label: "Design", value: "design" },
				{ label: "Code", value: "code" },
			],
		}
		const { container } = rich(declaration, ["design", "other"])
		expect(container).toHaveTextContent("Design")
		expect(container).toHaveTextContent("other")
	})

	it("shows a dash for a multi_select with nothing chosen", () => {
		const declaration = { type: "multi_select", label: "Tags", options: [] }
		expect(rich(declaration, []).container).toHaveTextContent("—")
	})
})

////////////////////// BOOKKEEPING //////////////////////

describe("what the dispatcher decides before any type does", () => {
	it("shows a dash for a value nobody filled in", () => {
		expect(
			rich({ type: "text", label: "Title" }, null).container,
		).toHaveTextContent("—")
		expect(
			rich({ type: "text", label: "Title" }, "").container,
		).toHaveTextContent("—")
		expect(
			rich({ type: "text", label: "Title" }, undefined).container,
		).toHaveTextContent("—")
	})

	it("dumps a value nested past the render limit rather than rendering it", () => {
		const { container } = rich({ type: "text", label: "Title" }, "Hello", {
			depth: 5,
		})
		expect(container.querySelector("pre")).toHaveTextContent('"Hello"')
	})

	it("dumps an array nested past the accordion limit", () => {
		const declaration = {
			type: "array",
			label: "Links",
			items: [{ type: "text", label: "Link" }],
		}
		const { container } = rich(declaration, ["a"], { accordionDepth: 2 })
		expect(container.querySelector("pre")).toHaveTextContent('"a"')
	})
})

////////////////////// OBJECT //////////////////////

describe("the rich panel over an object", () => {
	const seo = {
		type: "object",
		label: "SEO",
		fields: {
			title: { type: "text", label: "Meta title" },
			noindex: { type: "boolean", label: "No index" },
		},
	}

	it("lists each sub-field with its label", () => {
		const { container } = rich(seo, { title: "Home", noindex: false })
		expect(container).toHaveTextContent("Meta title")
		expect(container).toHaveTextContent("Home")
		expect(container).toHaveTextContent("No index")
		expect(container).toHaveTextContent("false")
	})

	it("shows a dash for a sub-field the value omits", () => {
		expect(rich(seo, { noindex: true }).container).toHaveTextContent("—")
	})

	it("dumps an object whose schema declares no fields", () => {
		const { container } = rich(
			{ type: "object", label: "Meta", fields: {} },
			{ a: 1 },
		)
		expect(container.querySelector("pre")).toHaveTextContent('"a": 1')
	})
})

////////////////////// ARRAY //////////////////////

const sections = {
	type: "array",
	label: "Sections",
	items: [
		{
			type: "object",
			label: "Section",
			fields: {
				title: { type: "text", label: "Title" },
				body: { type: "text", label: "Body" },
			},
		},
	],
}

describe("the rich panel over an array at the top level", () => {
	function renderSections(value: unknown) {
		return rich(sections, value, {
			editorPath: EDITOR_PATH,
			fieldKey: "sections",
		})
	}

	it("heads a card with the array's label and an Add link for its item", () => {
		const { container } = renderSections([{ title: "Intro" }])
		expect(container).toHaveTextContent("Sections")
		const add = screen.getByRole("link", { name: "Add Section" })
		expect(add).toHaveAttribute("href", `${EDITOR_PATH}/sections/new`)
	})

	it("gives each row a numbered trigger titled by its title-ish field", () => {
		renderSections([{ title: "Intro" }, { title: "Pricing" }])
		const triggers = screen.getAllByRole("button")
		expect(triggers).toHaveLength(2)
		expect(triggers[0]).toHaveTextContent("Intro")
		expect(triggers[0]).toHaveTextContent("#1")
		expect(triggers[1]).toHaveTextContent("Pricing")
		expect(triggers[1]).toHaveTextContent("#2")
	})

	it("falls back to a numbered item label when the row has no title", () => {
		renderSections([{ body: "only a body" }])
		expect(screen.getByRole("button")).toHaveTextContent("Section 1")
	})

	it("gives each row an Edit link addressed by its one-based position", () => {
		renderSections([{ title: "Intro" }, { title: "Pricing" }])
		const links = screen.getAllByRole("link", { name: "Edit" })
		expect(links[0]).toHaveAttribute("href", `${EDITOR_PATH}/sections/1`)
		expect(links[1]).toHaveAttribute("href", `${EDITOR_PATH}/sections/2`)
	})

	it("says so when the array holds nothing", () => {
		expect(renderSections([]).container).toHaveTextContent("No items.")
	})

	it("shows the row's fields once the row is opened", () => {
		renderSections([{ title: "Intro", body: "Welcome" }])
		fireEvent.click(screen.getByRole("button"))
		const panel = document.querySelector(
			"[data-slot='accordion-content']",
		) as HTMLElement
		expect(within(panel).getByText("Welcome")).toBeInTheDocument()
		expect(panel).toHaveTextContent("Body")
	})

	it("offers no Add or Edit link when the page hands it no editor path", () => {
		rich(sections, [{ title: "Intro" }])
		expect(screen.queryByRole("link")).toBeNull()
	})
})

describe("the rich panel over an array nested one level down", () => {
	it("drops the card for a plain section counting its items", () => {
		const { container } = rich(sections, [{ title: "Intro" }], {
			accordionDepth: 1,
		})
		expect(container.querySelector("h5")).toHaveTextContent("Sections")
		expect(container).toHaveTextContent("1 item")
		expect(screen.queryByRole("link")).toBeNull()
	})

	it("counts more than one item in the plural", () => {
		const { container } = rich(
			sections,
			[{ title: "Intro" }, { title: "Pricing" }],
			{ accordionDepth: 1 },
		)
		expect(container).toHaveTextContent("2 items")
	})
})

describe("the rich panel over an array of one scalar item", () => {
	const links = {
		type: "array",
		label: "Links",
		itemLabel: "link",
		items: [{ type: "url", label: "Link" }],
	}

	it("titles each row with the row's own value", () => {
		rich(links, ["https://kobun.io"], {
			editorPath: EDITOR_PATH,
			fieldKey: "links",
		})
		expect(screen.getByRole("button")).toHaveTextContent("https://kobun.io")
		expect(screen.getByRole("link", { name: "Add Link" })).toBeInTheDocument()
	})
})

describe("the rich panel over an array of several items", () => {
	const stats = {
		type: "array",
		label: "Stats",
		items: [
			{ type: "text", label: "name" },
			{ type: "text", label: "Value" },
		],
	}

	it("reads a row given as a record keyed by item label", () => {
		rich(stats, [{ name: "Users", Value: "12" }], {
			editorPath: EDITOR_PATH,
			fieldKey: "stats",
		})
		expect(screen.getByRole("button")).toHaveTextContent("Users")
	})

	it("reads a row given as a tuple, addressed by position", () => {
		rich(stats, [["Users", "12"]], {
			editorPath: EDITOR_PATH,
			fieldKey: "stats",
		})
		expect(screen.getByRole("button")).toHaveTextContent("Users")
	})

	it("dumps an array whose schema declares no items", () => {
		const { container } = rich({ type: "array", label: "Empty", items: [] }, [
			"a",
		])
		expect(container.querySelector("pre")).toHaveTextContent('"a"')
	})
})

////////////////////// INLINE //////////////////////

describe("the one-line summary", () => {
	it("shows text, a slug and a url as themselves", () => {
		expect(
			inline({ type: "text", label: "Title" }, "Hello").container,
		).toHaveTextContent("Hello")
		expect(
			inline({ type: "slug", label: "Slug", from: "title" }, "my-post")
				.container,
		).toHaveTextContent("my-post")
		expect(
			inline({ type: "url", label: "Site" }, "https://kobun.io").container,
		).toHaveTextContent("https://kobun.io")
	})

	it("shows a date as a short calendar day, not a distance", () => {
		expect(
			inline({ type: "date", label: "Published" }, "2026-07-14").container,
		).toHaveTextContent("Jul 14, 2026")
	})

	it("shows a datetime with its time of day", () => {
		const { container } = inline(
			{ type: "datetime", label: "Published at" },
			"2026-07-14T09:30:00.000Z",
		)
		expect(container.textContent).toMatch(
			/^Jul 14, 2026, \d{1,2}:\d{2} (AM|PM)$/,
		)
	})

	it("falls back to the raw value for a date or datetime it cannot parse", () => {
		expect(
			inline({ type: "date", label: "Published" }, "nope").container,
		).toHaveTextContent("nope")
		expect(
			inline({ type: "datetime", label: "Published at" }, "nope").container,
		).toHaveTextContent("nope")
	})

	it("capitalizes a boolean", () => {
		expect(
			inline({ type: "boolean", label: "Draft" }, true).container,
		).toHaveTextContent("True")
		expect(
			inline({ type: "boolean", label: "Draft" }, "true").container,
		).toHaveTextContent("True")
		expect(
			inline({ type: "boolean", label: "Draft" }, false).container,
		).toHaveTextContent("False")
	})

	it("shows a select and a multi_select as their option labels", () => {
		const options = [
			{ label: "Design", value: "design" },
			{ label: "Code", value: "code" },
		]
		expect(
			inline({ type: "select", label: "Status", options }, "design").container,
		).toHaveTextContent("Design")
		expect(
			inline({ type: "multi_select", label: "Tags", options }, [
				"design",
				"code",
			]).container,
		).toHaveTextContent("Design, Code")
	})

	it("shows a dash for a value nobody filled in", () => {
		expect(
			inline({ type: "text", label: "Title" }, "").container,
		).toHaveTextContent("—")
		expect(
			inline({ type: "text", label: "Title" }, null).container,
		).toHaveTextContent("—")
	})

	it("dumps an image, an array and an object as raw strings", () => {
		expect(
			inline({ type: "image", label: "Cover" }, "assets/cover.png").container,
		).toHaveTextContent("assets/cover.png")
		expect(
			inline({ type: "array", label: "Tags", items: [] }, ["a", "b"]).container,
		).toHaveTextContent("a,b")
		expect(
			inline({ type: "object", label: "SEO", fields: {} }, { a: 1 }).container,
		).toHaveTextContent("[object Object]")
	})
})
