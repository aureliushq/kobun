import { describe, expect, it, test } from "vitest"
import { singletonSchema } from "@/config/schema"
import type { NormalizedConfig } from "@/config/types"
import {
	parentItemTitle,
	requireCollection,
	requireParentItem,
	requireSingleton,
	requireSubcollection,
} from "./entities"
import {
	catchResponse,
	TEST_CONFIG,
	TEST_SUBCOLLECTION_CONFIG,
} from "./test-harness"

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

const SUBCOLLECTION_CTX = { config: TEST_SUBCOLLECTION_CONFIG }

test("finds a Subcollection and the directory beside its Parent Item's file", () => {
	const directory = requireSubcollection(
		SUBCOLLECTION_CTX,
		"projects",
		"updates",
		"acme",
	)

	expect(directory.collection).toBe(
		TEST_SUBCOLLECTION_CONFIG.collections.projects.subcollections?.updates,
	)
	expect(directory.parent.directoryPath).toBe("content/projects")
	expect(directory.directoryPath).toBe("content/projects/acme/updates")
})

// Its Drafts are owned by all three, so a second Parent Item's or a second
// Subcollection's are never mistaken for these (#182).
test("names the Collection, Parent Item and Subcollection its Drafts are owned by", () => {
	const { collectionSlug, parentItem, subcollectionKey } = requireSubcollection(
		SUBCOLLECTION_CTX,
		"projects",
		"updates",
		"acme",
	)

	expect({ collectionSlug, parentItem, subcollectionKey }).toEqual({
		collectionSlug: "projects",
		parentItem: "acme",
		subcollectionKey: "updates",
	})
})

test("refuses a Subcollection key the Collection does not declare", () => {
	expect(
		statusOfThrown(() =>
			requireSubcollection(SUBCOLLECTION_CTX, "projects", "invoices", "acme"),
		),
	).toBe(404)
})

test("refuses a Subcollection on a Collection that declares none", () => {
	expect(
		statusOfThrown(() =>
			requireSubcollection(SUBCOLLECTION_CTX, "posts", "updates", "hello"),
		),
	).toBe(404)
})

describe("the Parent Item a URL names", () => {
	const PARENTS = [{ name: "acme.md" }, { name: "globex.mdx" }]

	it("is found by its filename stem, md or mdx", () => {
		expect(requireParentItem(PARENTS, "acme")).toBe(PARENTS[0])
		expect(requireParentItem(PARENTS, "globex")).toBe(PARENTS[1])
	})

	// The listing holds Sources only, so a Parent Item that exists only as a
	// Draft — or no longer exists — is not in it.
	it("is a 404 when it has no Source", () => {
		expect(statusOfThrown(() => requireParentItem(PARENTS, "initech"))).toBe(
			404,
		)
	})

	// A stem names a directory a commit writes into, so one that is no file's
	// never reaches a path.
	it("is a 404 for a stem that would climb out of the Collection", () => {
		expect(statusOfThrown(() => requireParentItem(PARENTS, ".."))).toBe(404)
	})
})

describe("a Parent Item's title", () => {
	const PROJECTS = TEST_SUBCOLLECTION_CONFIG.collections.projects

	it("is its title Field", () => {
		expect(
			parentItemTitle(PROJECTS, { data: { title: "Acme" }, name: "acme.md" }),
		).toBe("Acme")
	})

	it("falls back to its filename stem when the title is empty", () => {
		expect(
			parentItemTitle(PROJECTS, { data: { title: "" }, name: "acme.mdx" }),
		).toBe("acme")
	})

	it("falls back to its filename stem when the schema has no title", () => {
		expect(
			parentItemTitle(
				{ ...PROJECTS, schema: {} },
				{ data: { title: "Acme" }, name: "acme.md" },
			),
		).toBe("acme")
	})
})
