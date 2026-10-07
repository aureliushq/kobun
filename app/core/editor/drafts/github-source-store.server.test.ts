import { beforeEach, expect, test, vi } from "vitest"
import {
	commitGithubFiles,
	createOrUpdateGithubTextFile,
} from "@/github/octokit.server"
import { createGithubSourceStore } from "./github-source-store.server"

vi.mock("@/github/octokit.server", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/github/octokit.server")>()),
	commitGithubFiles: vi.fn(),
	createOrUpdateGithubTextFile: vi.fn(),
}))

const store = createGithubSourceStore({
	env: {} as Env,
	installationId: 1,
	name: "blog",
	owner: "acme",
})
const IMAGE = { bytes: new Uint8Array([1, 2, 3]), path: "media/cat.png" }
const WRITE = {
	content: "# Hello\n",
	expectedSha: "md-1",
	message: "Update content/posts/hello.md with Kobun",
	path: "content/posts/hello.md",
}

beforeEach(() => {
	vi.mocked(commitGithubFiles).mockReset()
	vi.mocked(createOrUpdateGithubTextFile).mockReset()
})

test("commits the content and its images together", async () => {
	vi.mocked(commitGithubFiles).mockResolvedValue({
		commitSha: "commit-1",
		shas: { "content/posts/hello.md": "md-2", "media/cat.png": "img-1" },
	})

	const result = await store.write({ ...WRITE, images: [IMAGE] })

	expect(result).toEqual({
		commitSha: "commit-1",
		contentSha: "md-2",
		ok: true,
	})
	expect(commitGithubFiles).toHaveBeenCalledWith({}, 1, "acme", "blog", {
		files: [
			{ content: IMAGE.bytes, path: "media/cat.png" },
			{ content: WRITE.content, path: WRITE.path },
		],
		guard: { path: WRITE.path, sha: "md-1" },
		message: WRITE.message,
	})
	expect(createOrUpdateGithubTextFile).not.toHaveBeenCalled()
})

test("reports a guard the repository refused as a stale sha", async () => {
	vi.mocked(commitGithubFiles).mockResolvedValue(null)

	const result = await store.write({
		...WRITE,
		expectedSha: undefined,
		images: [IMAGE],
	})

	expect(result).toEqual({ ok: false, reason: "stale-sha" })
	expect(commitGithubFiles).toHaveBeenCalledWith(
		{},
		1,
		"acme",
		"blog",
		expect.objectContaining({ guard: { path: WRITE.path, sha: null } }),
	)
})

test("content with no images is written as before", async () => {
	vi.mocked(createOrUpdateGithubTextFile).mockResolvedValue({
		commitSha: "commit-1",
		contentSha: "md-2",
	})

	const result = await store.write({ ...WRITE, images: [] })

	expect(result).toEqual({
		commitSha: "commit-1",
		contentSha: "md-2",
		ok: true,
	})
	expect(commitGithubFiles).not.toHaveBeenCalled()
})
