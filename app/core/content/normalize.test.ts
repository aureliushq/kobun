import { describe, expect, it } from "vitest"
import { canonicalMetadata } from "./normalize"

describe("Data comparison", () => {
	it("compares records independent of key order", () => {
		expect(canonicalMetadata({ b: 2, a: 1 })).toBe(
			canonicalMetadata({ a: 1, b: 2 }),
		)
	})
})
