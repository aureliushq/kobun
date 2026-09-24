import invariant from "tiny-invariant"
import { describe, expect, it } from "vitest"
import { arrayFieldSchema } from "@/config/schema"
import { describeRow, rowValues, withRowValues } from "./composite"

/**
 * The one description of an array's row shape, which the rich panel and the row
 * editor both read (#164). How each shape looks on the page and in the editor is
 * covered where those live; this covers the split itself, and the round trip the
 * row editor saves through.
 */

const LABEL_ITEM = { label: "Label", type: "text" }
const URL_ITEM = { label: "URL", type: "text" }
const OBJECT_ITEM = {
	fields: {
		name: { label: "Name", type: "text" },
		role: { label: "Role", type: "text" },
	},
	label: "Member",
	type: "object",
}

/** The shape of an array declaring these items, which these all declare some of. */
function shapeOf(items: unknown[]) {
	const shape = describeRow(
		arrayFieldSchema.parse({ items, label: "Rows", type: "array" }),
	)
	invariant(shape, "An array declaring items has a row shape")
	return shape
}

describe("the shape of an array's rows", () => {
	it("makes one declared object item a record of that object's own Fields", () => {
		const shape = shapeOf([OBJECT_ITEM])
		expect(shape.kind).toBe("object")
		expect(shape.entries.map((entry) => entry.key)).toEqual(["name", "role"])
	})

	it("makes one declared item of any other Type the row's value outright", () => {
		const shape = shapeOf([LABEL_ITEM])
		expect(shape.kind).toBe("scalar")
		expect(rowValues(shape, "Home")).toEqual({ Label: "Home" })
		expect(withRowValues(shape, "Home", { Label: "Blog" })).toBe("Blog")
	})

	it("keys several declared items by item label, whichever shape the row was written in", () => {
		const shape = shapeOf([LABEL_ITEM, URL_ITEM])
		expect(shape.kind).toBe("composite")
		expect(rowValues(shape, ["Home", "/"])).toEqual({ Label: "Home", URL: "/" })
		expect(
			withRowValues(shape, ["Home", "/"], { Label: "Start", URL: "/" }),
		).toEqual(["Start", "/"])
		expect(
			withRowValues(
				shape,
				{ Label: "Blog", URL: "/blog" },
				{ Label: "News", URL: "/blog" },
			),
		).toEqual({ Label: "News", URL: "/blog" })
	})

	it("describes no row for an array that declares no items", () => {
		expect(
			describeRow(
				arrayFieldSchema.parse({ items: [], label: "Rows", type: "array" }),
			),
		).toBeNull()
	})

	it("keeps an object row's keys the schema never declared", () => {
		const shape = shapeOf([OBJECT_ITEM])
		const row = { extra: true, name: "Ada", role: "Engineer" }
		const values = rowValues(shape, row)
		expect(values).toEqual(row)
		expect(withRowValues(shape, row, { ...values, role: "Admiral" })).toEqual({
			extra: true,
			name: "Ada",
			role: "Admiral",
		})
	})
})
