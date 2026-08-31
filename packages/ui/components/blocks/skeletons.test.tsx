import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CardListSkeleton, PageHeaderSkeleton } from "./skeletons"

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

describe("skeleton determinism", () => {
	// A width that differs between the server render and the client one is a
	// hydration mismatch. Two renders agreeing is the cheapest proof there is no
	// `Math.random` behind any of them.
	it.each([
		["CardListSkeleton", <CardListSkeleton count={3} key="c" />],
		["PageHeaderSkeleton", <PageHeaderSkeleton key="p" />],
	])("renders %s identically every time", (_name, element) => {
		expect(render(element).container.innerHTML).toBe(
			render(element).container.innerHTML,
		)
	})
})
