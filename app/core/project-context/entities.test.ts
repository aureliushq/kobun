import { expect, test } from "vitest"
import { singletonSchema } from "@/config/schema"
import type { NormalizedConfig } from "@/config/types"
import { requireCollection, requireSingleton } from "./entities"
import { catchResponse, TEST_CONFIG } from "./test-harness"

function withBasePath(basePath: string) {
	return { config: { ...TEST_CONFIG, basePath } as NormalizedConfig }
}

const CTX = { config: TEST_CONFIG }

function statusOfThrown(run: () => unknown): number {
	return catchResponse(run).status
}

test("finds a Collection and the directory its Sources live in", () => {
	const { collection, directoryPath } = requireCollection(CTX, "posts")

	expect(collection).toBe(TEST_CONFIG.collections.posts)
	expect(directoryPath).toBe("content/posts")
})

test.each([
	["content", "content/posts"],
	["content/", "content/posts"],
	["/content//", "/content/posts"],
	["", "/posts"],
])("collapses repeated slashes in a base path of %o", (basePath, expected) => {
	expect(requireCollection(withBasePath(basePath), "posts").directoryPath).toBe(
		expected,
	)
})

test("refuses a Collection slug the Config does not declare", () => {
	expect(statusOfThrown(() => requireCollection(CTX, "drafts"))).toBe(404)
})

test("finds a Singleton and the file it lives in", () => {
	const { filePath, singleton } = requireSingleton(CTX, "about")

	expect(singleton).toBe(TEST_CONFIG.singletons.about)
	expect(filePath).toBe("content/singletons/about.md")
})

test("names the Singleton's file after its own Format", () => {
	// Parsed through the real schema so the fixture cannot drift from a legal
	// Config — a data-only Format may not declare a Document field.
	const about = singletonSchema.parse({
		format: "json",
		label: "About",
		schema: { title: { label: "Title", type: "text" } },
	})

	expect(
		requireSingleton(
			{ config: { ...TEST_CONFIG, singletons: { about } } },
			"about",
		).filePath,
	).toBe("content/singletons/about.json")
})

test("refuses a Singleton slug the Config does not declare", () => {
	expect(statusOfThrown(() => requireSingleton(CTX, "contact"))).toBe(404)
})
