import { describe, expect, it } from "vitest"
import { canonicalMetadata, normalizeMetadata } from "./normalize"

describe("Data normalization", () => {
	it("normalizes YAML dates before comparison and transport", () => {
		expect(
			normalizeMetadata({
				published: new Date("2026-07-14T00:00:00.000Z"),
			}),
		).toEqual({ published: "2026-07-14" })
	})

	it("compares records independent of key order", () => {
		expect(canonicalMetadata({ b: 2, a: 1 })).toBe(
			canonicalMetadata({ a: 1, b: 2 }),
		)
	})
})
