import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
	CardListSkeleton,
	EditorBodySkeleton,
	TableRowsSkeleton,
} from "./skeletons"

describe("<CardListSkeleton />", () => {
	it("reserves one card per item it stands in for", () => {
		const { container } = render(<CardListSkeleton count={2} />)

		expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(2)
	})

	it("keeps the card's own header grid, so the real card lands in the same box", () => {
		const { container } = render(<CardListSkeleton count={1} />)

		expect(
			container.querySelector('[data-slot="card-description"]'),
		).toBeInTheDocument()
		expect(
			container.querySelector('[data-slot="card-action"]'),
		).toBeInTheDocument()
	})
})

/** A `<tr>` only belongs under a `<tbody>`; anywhere else React warns. */
const inATable = (element: ReactNode) => (
	<table>
		<tbody>{element}</tbody>
	</table>
)

describe("<TableRowsSkeleton />", () => {
	it("reserves one row per item it stands in for", () => {
		const { container } = render(inATable(<TableRowsSkeleton count={3} />))

		expect(container.querySelectorAll('[data-slot="table-row"]')).toHaveLength(
			3,
		)
	})

	// The `createdAt` column renders nothing but still occupies a cell, so a
	// skeleton row one cell short would size the columns differently than the
	// header until the real rows landed.
	it("keeps a cell for every column the table declares, rendered or not", () => {
		const { container } = render(inATable(<TableRowsSkeleton count={1} />))

		expect(container.querySelectorAll('[data-slot="table-cell"]')).toHaveLength(
			3,
		)
	})
})

describe("<EditorBodySkeleton />", () => {
	it("reserves one block per paragraph it stands in for", () => {
		const { container } = render(<EditorBodySkeleton count={2} />)

		expect(container.querySelectorAll(".mb-5")).toHaveLength(2)
	})

	// The gutter and the min-height are `.ProseMirror`'s own box. A placeholder
	// narrower or shorter than the editor it stands in for moves the prose
	// sideways, or lets the page collapse and rebound, the moment it lands.
	it("keeps the writing column's gutter and the editor's min-height", () => {
		const { container } = render(<EditorBodySkeleton count={1} />)

		expect(container.querySelector(".pl-12")).toBeInTheDocument()
		expect(container.querySelector(".min-h-\\[640px\\]")).toBeInTheDocument()
	})
})

describe("skeleton determinism", () => {
	// A width that differs between the server render and the client one is a
	// hydration mismatch. Two renders agreeing is the cheapest proof there is no
	// `Math.random` behind any of them.
	it.each([
		["CardListSkeleton", <CardListSkeleton count={3} key="c" />],
		["EditorBodySkeleton", <EditorBodySkeleton count={3} key="e" />],
		["TableRowsSkeleton", inATable(<TableRowsSkeleton count={3} key="t" />)],
	])("renders %s identically every time", (_name, element) => {
		expect(render(element).container.innerHTML).toBe(
			render(element).container.innerHTML,
		)
	})
})
