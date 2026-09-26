import { beforeEach, expect, test, vi } from "vitest"
import { getGithubFileBytes, getGithubFileSha } from "@/github/octokit.server"
import { loader } from "./api.repo-asset"

vi.mock("@/core/project-context/project-context.server", () => ({
	requireApiAccess: async () => ({
		env: {},
		installationId: 1,
		name: "site",
		owner: "acme",
	}),
}))

vi.mock("@/github/octokit.server", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/github/octokit.server")>()),
	getGithubFileBytes: vi.fn(),
	getGithubFileSha: vi.fn(),
}))

const SHA = "abc123"
const BYTES = new Uint8Array([1, 2, 3])

function notFoundError() {
	return Object.assign(new Error("Not Found"), { status: 404 })
}

function load(headers: Record<string, string> = {}) {
	return loader({
		params: { "*": "images/logo.png", name: "site", owner: "acme" },
		request: new Request(
			"http://localhost/repo-asset/acme/site/images/logo.png",
			{
				headers,
			},
		),
	} as unknown as Parameters<typeof loader>[0])
}

beforeEach(() => {
	vi.mocked(getGithubFileSha).mockReset().mockResolvedValue(SHA)
	vi.mocked(getGithubFileBytes)
		.mockReset()
		.mockResolvedValue({ bytes: BYTES, path: "images/logo.png", sha: SHA })
})

test("answers a copy that is still current with a 304, without downloading it", async () => {
	const response = await load({ "If-None-Match": `"${SHA}"` })

	expect(response.status).toBe(304)
	expect(response.headers.get("ETag")).toBe(`"${SHA}"`)
	expect(getGithubFileBytes).not.toHaveBeenCalled()
})

test("sends the picture when the browser's copy is out of date", async () => {
	vi.mocked(getGithubFileSha).mockResolvedValue("newer")
	vi.mocked(getGithubFileBytes).mockResolvedValue({
		bytes: BYTES,
		path: "images/logo.png",
		sha: "newer",
	})

	const response = await load({ "If-None-Match": `"${SHA}"` })

	expect(response.status).toBe(200)
	expect(response.headers.get("ETag")).toBe('"newer"')
	expect(response.headers.get("Content-Type")).toBe("image/png")
	expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES)
})

test("downloads straight away when the browser holds no copy", async () => {
	const response = await load()

	expect(response.status).toBe(200)
	expect(response.headers.get("ETag")).toBe(`"${SHA}"`)
	expect(getGithubFileSha).not.toHaveBeenCalled()
})

test("answers a missing file with a 404, with or without a copy", async () => {
	vi.mocked(getGithubFileSha).mockResolvedValue(null)
	vi.mocked(getGithubFileBytes).mockRejectedValue(notFoundError())

	expect((await load({ "If-None-Match": `"${SHA}"` })).status).toBe(404)
	expect((await load()).status).toBe(404)
	expect(getGithubFileBytes).toHaveBeenCalledOnce()
})
