import { describe, expect, it } from "vitest"
import { storedConfigErrors } from "@/config/errors"
import { TEST_CONFIG } from "@/core/project-context/test-harness"
import type { Project } from "@/db/types"
import { ConfigStatus } from "@/db/types"
import { describeProjectConfig } from "./project-config"

/**
 * What the Project settings page says about a repository's Config (#136).
 *
 * The page shows this and never edits it (ADR-0010), so every assertion here is
 * about what a writer is told — including when there is nothing to tell them
 * but what went wrong (ADR-0007).
 */

const CHECKED_AT = new Date("2026-09-01T12:00:00Z")

function row(overrides: Partial<Project> = {}) {
	return {
		configCheckedAt: CHECKED_AT,
		configError: "",
		configPath: ".kobun.json",
		configStatus: ConfigStatus.PRESENT,
		repoHtmlUrl: "https://github.com/acme/blog",
		...overrides,
	} as Project
}

describe("a Config Kobun could read", () => {
	it("lists the Collections and Singletons it declares", () => {
		const view = describeProjectConfig(row(), TEST_CONFIG, null)

		expect(view.collections).toEqual([
			{ format: "md", label: "Posts", slug: "posts" },
		])
		expect(view.singletons).toEqual([
			{ format: "md", label: "About", slug: "about" },
		])
	})

	it("points at the file the Config was read from", () => {
		const view = describeProjectConfig(row(), TEST_CONFIG, null)

		expect(view.fileUrl).toBe(
			"https://github.com/acme/blog/blob/HEAD/.kobun.json",
		)
		expect(view.path).toBe(".kobun.json")
		expect(view.lastCheckedAt).toEqual(CHECKED_AT)
		expect(view.status).toBe(ConfigStatus.PRESENT)
	})

	it("still reports the parts of it that did not validate", () => {
		const partial = {
			...TEST_CONFIG,
			errors: [
				{
					code: "missing_required",
					message: "label is required",
					path: "collections.notes",
				},
			],
		}

		const view = describeProjectConfig(row(), partial, null)

		expect(view.errors).toEqual(partial.errors)
		// A served Config still declares what it declares.
		expect(view.collections).toHaveLength(1)
	})
})

describe("a Config Kobun could not use", () => {
	it("declares nothing, and says what was wrong with it", () => {
		const stored = storedConfigErrors([
			{
				code: "parse_error",
				message: "Unexpected token }",
				path: ".kobun.json",
			},
		])

		const view = describeProjectConfig(
			row({ configError: stored, configStatus: ConfigStatus.ERROR }),
			null,
			"config-invalid",
		)

		expect(view.collections).toEqual([])
		expect(view.singletons).toEqual([])
		expect(view.errors).toEqual([
			{
				code: "parse_error",
				message: "Unexpected token }",
				path: ".kobun.json",
			},
		])
	})

	it("offers no file link when the repository holds no Config at all", () => {
		// `syncProjectConfig` falls back to the first candidate path when it found
		// nothing, so the column names a file that does not exist.
		const view = describeProjectConfig(
			row({ configStatus: ConfigStatus.MISSING }),
			null,
			"config-missing",
		)

		expect(view.fileUrl).toBeNull()
		expect(view.errors.map((error) => error.code)).toEqual(["no_config"])
	})

	it("says a repository it could not reach is unreachable, not invalid", () => {
		const view = describeProjectConfig(
			row({
				configError: storedConfigErrors([
					{ code: "parse_error", message: "old news", path: "" },
				]),
			}),
			null,
			"config-unreadable",
		)

		expect(view.errors.map((error) => error.code)).toEqual([
			"unreadable_config",
		])
	})
})
