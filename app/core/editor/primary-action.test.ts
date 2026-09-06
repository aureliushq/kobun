import { describe, expect, it } from "vitest"

import {
	DEFAULT_PRIMARY_EDITOR_ACTION,
	getPrimaryEditorActionFromRequest,
	isPrimaryEditorAction,
	serializePrimaryEditorActionCookie,
} from "./primary-action"

/**
 * Which of the two targets the split control's primary button runs, and how
 * that choice survives a reload (#107).
 *
 * The default is pinned here on purpose. It is a decision made on a writer's
 * behalf — the one action whose accidental press costs nothing — and a silent
 * change to it would put a commit in somebody's repository.
 */

function requestWithCookie(cookie: string) {
	return new Request("https://kobun.test/", { headers: { Cookie: cookie } })
}

describe("the primary action a writer has never chosen", () => {
	it("is Save, so a first click cannot reach the repository", () => {
		expect(DEFAULT_PRIMARY_EDITOR_ACTION).toBe("save")
	})

	it("is what a request carrying no cookie at all answers with", () => {
		expect(
			getPrimaryEditorActionFromRequest(new Request("https://kobun.test/")),
		).toBe("save")
	})

	it("is what an unrecognised value falls back to rather than throwing", () => {
		expect(
			getPrimaryEditorActionFromRequest(
				requestWithCookie("editor-primary-action=publish"),
			),
		).toBe("save")
	})
})

describe("the choice a writer did make", () => {
	it("round-trips through the cookie, both ways round", () => {
		for (const action of ["save", "commit"] as const) {
			const cookie = serializePrimaryEditorActionCookie(action)
			const [pair] = cookie.split(";")
			expect(getPrimaryEditorActionFromRequest(requestWithCookie(pair))).toBe(
				action,
			)
		}
	})

	it("is read past the other cookies a browser sends alongside it", () => {
		expect(
			getPrimaryEditorActionFromRequest(
				requestWithCookie(
					"theme=dark; editor-primary-action=commit; sidebar=1",
				),
			),
		).toBe("commit")
	})

	// Surviving a reload and a move to another Item is the whole point, and it is
	// this Max-Age that does it. Path=/ because the editor is nested deep.
	it("is written to last a year and to be sent from every path", () => {
		const cookie = serializePrimaryEditorActionCookie("commit")

		expect(cookie).toContain("editor-primary-action=commit")
		expect(cookie).toContain("Path=/")
		expect(cookie).toContain("SameSite=Lax")
		expect(cookie).toContain("Max-Age=31536000")
	})
})

describe("what counts as a target at all", () => {
	it("admits the two the split control offers", () => {
		expect(isPrimaryEditorAction("save")).toBe(true)
		expect(isPrimaryEditorAction("commit")).toBe(true)
	})

	// Publish is a separate button and never a primary (ADR-0008), so it must
	// not be settable through the same door.
	it("refuses Publish, and anything that is not a string", () => {
		expect(isPrimaryEditorAction("publish")).toBe(false)
		expect(isPrimaryEditorAction(null)).toBe(false)
		expect(isPrimaryEditorAction(undefined)).toBe(false)
	})
})
