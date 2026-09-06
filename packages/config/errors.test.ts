import { expect, test } from "vitest"
import {
	parseConfigErrors,
	scopeConfigErrors,
	storedConfigErrors,
} from "./errors"

// The dashboard renders a parse error's path as the filename it could not read,
// and the validator is told the Format rather than the file.
test("scopes a path-less parse error to the file it was read from", () => {
	const scoped = scopeConfigErrors(
		[{ code: "parse_error", message: "boom", path: "" }],
		".kobun.yml",
	)

	expect(scoped).toEqual([
		{ code: "parse_error", message: "boom", path: ".kobun.yml" },
	])
})

test("leaves a validation error's path alone", () => {
	const errors = [
		{ code: "invalid_type", message: "nope", path: "collections.posts" },
	]

	expect(scopeConfigErrors(errors, ".kobun.json")).toEqual(errors)
})

// The column's two halves have to agree about an empty list, or a Config that
// reads cleanly leaves the previous diagnosis standing.
test("round-trips through the stored column", () => {
	const errors = [{ code: "no_collections", message: "none", path: "x" }]

	expect(parseConfigErrors(storedConfigErrors(errors))).toEqual(errors)
	expect(parseConfigErrors(storedConfigErrors([]))).toEqual([])
})
