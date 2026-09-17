import { describe, expect, it } from "vitest"
import {
	TEST_SINGLETON,
	TEST_SINGLETON_WITH_FEATURES,
} from "@/core/editor/drafts/test-harness"

import { orderedSchemaEntries } from "./singleton"

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
