import { describe, expect, it } from "vitest"
import type { DraftRefusal } from "@/core/editor/drafts"
import { draftRefusalResponse, readRefusalCode } from "./editor-action"

/**
 * The editor tells refusals apart by the code a response names, not by its
 * status: a Revision Conflict, a Stale Source and a duplicate Slug all answer
 * 409, and only the duplicate Slug is a failure (#166).
 */
describe("a refusal the editor is answered with", () => {
	it.each<[DraftRefusal, number]>([
		[{ code: "revision-conflict", ok: false }, 409],
		[{ code: "stale-source", ok: false }, 409],
		[{ code: "duplicate-slug", ok: false, slug: "hello" }, 409],
		[{ code: "not-found", ok: false }, 404],
		[{ code: "validation", errors: ["Title is required"], ok: false }, 422],
	])("names its code: %o", async (refusal, status) => {
		const response = draftRefusalResponse(refusal)

		expect(response.status).toBe(status)
		expect(await response.json()).toMatchObject({
			code: refusal.code,
			ok: false,
		})
	})

	it("reads back only a code the editor knows", () => {
		expect(readRefusalCode("revision-conflict")).toBe("revision-conflict")
		expect(readRefusalCode("toString")).toBeNull()
		expect(readRefusalCode(409)).toBeNull()
		expect(readRefusalCode(undefined)).toBeNull()
	})
})
