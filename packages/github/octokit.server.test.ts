import { afterEach, expect, test, vi } from "vitest"
import {
	commitGithubFiles,
	getGithubAppOctokit,
	getGithubFileBytes,
	getGithubInstallationOctokit,
} from "./octokit.server"

const env = {
	GITHUB_APP_ID: "3006163",
	GITHUB_APP_PRIVATE_KEY: "test-key",
} as Env

test("hands back the same installation client, so its token is reused", () => {
	expect(getGithubInstallationOctokit(env, 1)).toBe(
		getGithubInstallationOctokit(env, "1"),
	)
})

test("keeps one client per installation", () => {
	expect(getGithubInstallationOctokit(env, 1)).not.toBe(
		getGithubInstallationOctokit(env, 2),
	)
})

test("keeps the app client apart from any installation's", () => {
	expect(getGithubAppOctokit(env)).toBe(getGithubAppOctokit(env))
	expect(getGithubAppOctokit(env)).not.toBe(
		getGithubInstallationOctokit(env, 1),
	)
})

afterEach(() => {
	vi.restoreAllMocks()
})

/** The cached client the helpers reach for, so spies on it are seen by them. */
const client = () => getGithubInstallationOctokit(env, 7)

// The contents API inlines a file's bytes only up to 1 MB. Past that it answers
// with an empty `content` and `encoding: "none"`, which decoded as a 0-byte
// picture in the editor.
test("reads a file over 1 MB from its blob", async () => {
	const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff])
	vi.spyOn(client().repos, "getContent").mockResolvedValue({
		data: {
			content: "",
			encoding: "none",
			path: "media/big.png",
			sha: "blob-sha",
			type: "file",
		},
	} as never)
	const getBlob = vi.spyOn(client().git, "getBlob").mockResolvedValue({
		data: {
			content: Buffer.from(bytes).toString("base64"),
			encoding: "base64",
		},
	} as never)

	const file = await getGithubFileBytes(env, 7, "acme", "blog", "media/big.png")

	expect(getBlob).toHaveBeenCalledWith(
		expect.objectContaining({
			file_sha: "blob-sha",
			owner: "acme",
			repo: "blog",
		}),
	)
	expect(file).toMatchObject({ path: "media/big.png", sha: "blob-sha" })
	expect([...file.bytes]).toEqual([...bytes])
})

/** The default branch's head as the commit reads it, with the guarded file at `fileSha`. */
function head(commit: string, fileSha: string | null) {
	return {
		repository: {
			defaultBranchRef: {
				name: "main",
				target: {
					file: fileSha ? { oid: fileSha } : null,
					oid: commit,
					tree: { oid: `tree-of-${commit}` },
				},
			},
		},
	}
}

/** Blobs, a tree, a commit and a ref, each answering with a predictable sha. */
function stubGitData() {
	let blobs = 0
	return {
		createBlob: vi
			.spyOn(client().git, "createBlob")
			.mockImplementation(
				async () => ({ data: { sha: `blob-${++blobs}` } }) as never,
			),
		createCommit: vi
			.spyOn(client().git, "createCommit")
			.mockResolvedValue({ data: { sha: "new-commit" } } as never),
		createTree: vi
			.spyOn(client().git, "createTree")
			.mockResolvedValue({ data: { sha: "new-tree" } } as never),
		updateRef: vi
			.spyOn(client().git, "updateRef")
			.mockResolvedValue({ data: {} } as never),
	}
}

const IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff])
const FILES = [
	{ content: IMAGE, path: "media/cat.png" },
	{ content: "# Hello\n", path: "content/posts/hello.md" },
]

test("writes every file in one commit on the default branch", async () => {
	vi.spyOn(client(), "graphql").mockResolvedValue(
		head("head-1", "md-1") as never,
	)
	const git = stubGitData()

	const result = await commitGithubFiles(env, 7, "acme", "blog", {
		files: FILES,
		guard: { path: "content/posts/hello.md", sha: "md-1" },
		message: "Update content/posts/hello.md with Kobun",
	})

	expect(result).toEqual({
		commitSha: "new-commit",
		shas: { "content/posts/hello.md": "blob-2", "media/cat.png": "blob-1" },
	})
	// The image goes up as its bytes, not as text.
	expect(git.createBlob).toHaveBeenCalledWith(
		expect.objectContaining({
			content: Buffer.from(IMAGE).toString("base64"),
			encoding: "base64",
		}),
	)
	expect(git.createTree).toHaveBeenCalledWith(
		expect.objectContaining({
			base_tree: "tree-of-head-1",
			tree: [
				{ mode: "100644", path: "media/cat.png", sha: "blob-1", type: "blob" },
				{
					mode: "100644",
					path: "content/posts/hello.md",
					sha: "blob-2",
					type: "blob",
				},
			],
		}),
	)
	expect(git.createCommit).toHaveBeenCalledWith(
		expect.objectContaining({ parents: ["head-1"], tree: "new-tree" }),
	)
	expect(git.updateRef).toHaveBeenCalledWith(
		expect.objectContaining({
			force: false,
			ref: "heads/main",
			sha: "new-commit",
		}),
	)
})

test("writes nothing when the guarded file is no longer at the sha the caller expected", async () => {
	vi.spyOn(client(), "graphql").mockResolvedValue(
		head("head-1", "md-2") as never,
	)
	const git = stubGitData()

	const result = await commitGithubFiles(env, 7, "acme", "blog", {
		files: FILES,
		guard: { path: "content/posts/hello.md", sha: "md-1" },
		message: "Update",
	})

	expect(result).toBeNull()
	expect(git.createBlob).not.toHaveBeenCalled()
	expect(git.updateRef).not.toHaveBeenCalled()
})

test("refuses to create a file that already exists", async () => {
	vi.spyOn(client(), "graphql").mockResolvedValue(
		head("head-1", "md-1") as never,
	)
	stubGitData()

	const result = await commitGithubFiles(env, 7, "acme", "blog", {
		files: FILES,
		guard: { path: "content/posts/hello.md", sha: null },
		message: "Create",
	})

	expect(result).toBeNull()
})

// Any commit to the branch moves its head, and the ref update refuses to drop
// it. The guarded file may be untouched by that commit, so the commit is built
// again on the new head rather than refused.
test("builds the commit again on a head that moved while it was being written", async () => {
	vi.spyOn(client(), "graphql")
		.mockResolvedValueOnce(head("head-1", "md-1") as never)
		.mockResolvedValueOnce(head("head-2", "md-1") as never)
	const git = stubGitData()
	git.updateRef.mockRejectedValueOnce(
		Object.assign(new Error("Update is not a fast forward"), { status: 422 }),
	)

	const result = await commitGithubFiles(env, 7, "acme", "blog", {
		files: FILES,
		guard: { path: "content/posts/hello.md", sha: "md-1" },
		message: "Update",
	})

	expect(result).toMatchObject({ commitSha: "new-commit" })
	expect(git.createBlob).toHaveBeenCalledTimes(2)
	expect(git.createCommit).toHaveBeenLastCalledWith(
		expect.objectContaining({ parents: ["head-2"] }),
	)
})
