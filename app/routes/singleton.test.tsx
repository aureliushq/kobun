import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"
import type { Singleton as SingletonConfig } from "@/config/types"
import {
	TEST_SINGLETON,
	TEST_SINGLETON_WITH_FEATURES,
} from "@/core/editor/drafts/test-harness"

import Singleton, { orderedSchemaEntries } from "./singleton"

const keys = (entries: [string, unknown][]) => entries.map(([key]) => key)

describe("the order a Singleton's page lays its Fields out in", () => {
	it("keeps the Managed Fields apart, as the editor's panel does", () => {
		const { managed, ordered } = orderedSchemaEntries(
			TEST_SINGLETON_WITH_FEATURES.schema,
		)

		expect(keys(ordered)).toEqual(["title", "content"])
		expect(keys(managed)).toEqual([
			"createdAt",
			"updatedAt",
			"publishedAt",
			"status",
		])
	})

	it("has no Managed Fields to show for a Singleton with no Features", () => {
		const { managed } = orderedSchemaEntries(TEST_SINGLETON.schema)

		expect(managed).toEqual([])
	})
})

/**
 * The page reads its rows from the Source, while a row's editor opens the
 * Draft's row at that position (#161).
 */
describe("the row Edit links on a Singleton's page", () => {
	const EDITOR_PATH = "/acme/site/singletons/home/editor"
	// The schema literal is authored, not parsed, so its discriminants are cast.
	const SINGLETON = {
		...TEST_SINGLETON,
		format: "json",
		label: "Home",
		schema: {
			sections: {
				items: [
					{
						fields: { title: { label: "Title", type: "text" } },
						label: "Section",
						type: "object",
					},
				],
				label: "Sections",
				type: "array",
			},
		},
	} as SingletonConfig

	function page(draftId: string | null) {
		const Stub = createRoutesStub([
			{
				Component: Singleton,
				loader: () => ({
					body: null,
					data: { sections: [{ title: "Intro" }, { title: "Pricing" }] },
					draftId,
					editorPath: EDITOR_PATH,
					exists: true,
					filePath: "content/home.json",
					singleton: SINGLETON,
					singletonSlug: "home",
				}),
				path: "/:owner/:name/singletons/:singleton_slug",
			},
		])
		return render(<Stub initialEntries={["/acme/site/singletons/home"]} />)
	}

	it("addresses each row by its position when there is no Draft", async () => {
		page(null)

		const links = await screen.findAllByRole("link", { name: "Edit" })
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			EDITOR_PATH,
			`${EDITOR_PATH}/sections/1`,
			`${EDITOR_PATH}/sections/2`,
		])
	})

	it("offers no row link while a Dirty Draft may have moved the rows, but still offers Add", async () => {
		page("draft-1")

		const add = await screen.findByRole("link", { name: "Add in editor" })
		expect(add).toHaveAttribute("href", EDITOR_PATH)
		const links = screen.getAllByRole("link", { name: "Edit" })
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			EDITOR_PATH,
		])
	})
})
