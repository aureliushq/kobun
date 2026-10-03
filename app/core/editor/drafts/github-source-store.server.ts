import {
	commitGithubFiles,
	createOrUpdateGithubTextFile,
	getGithubFileContent,
	hasStatus,
} from "@/github/octokit.server"
import type { InstallationID } from "@/types/github"
import type {
	SourceStore,
	SourceWriteInput,
	SourceWriteResult,
} from "./source-store"

/**
 * The repository behind a project, as a `SourceStore`. Every piece of GitHub
 * identity stays in this closure, so callers of the port never handle an
 * installation, an owner, or an octokit error (ADR-0001).
 */
export function createGithubSourceStore(context: {
	env: Env
	installationId: InstallationID
	name: string
	owner: string
}): SourceStore {
	const { env, installationId, name, owner } = context

	return {
		read: async (path: string) => {
			try {
				const file = await getGithubFileContent(
					env,
					installationId,
					owner,
					name,
					path,
				)
				return {
					content: file.content,
					name: file.path.slice(file.path.lastIndexOf("/") + 1),
					path: file.path,
					sha: file.sha,
				}
			} catch (error) {
				if (hasStatus(error, 404)) return null
				throw error
			}
		},
		write: async (input: SourceWriteInput): Promise<SourceWriteResult> => {
			// Content linking to images commits them with it, all or none, so a
			// refused write leaves no image behind. Content alone keeps the one
			// call the contents API needs.
			if (input.images?.length) {
				const committed = await commitGithubFiles(
					env,
					installationId,
					owner,
					name,
					{
						files: [
							...input.images.map(({ bytes, path }) => ({
								content: bytes,
								path,
							})),
							{ content: input.content, path: input.path },
						],
						guard: { path: input.path, sha: input.expectedSha ?? null },
						message: input.message,
					},
				)
				if (!committed) return { ok: false, reason: "stale-sha" }
				return {
					commitSha: committed.commitSha,
					contentSha: committed.shas[input.path],
					ok: true,
				}
			}
			try {
				const { commitSha, contentSha } = await createOrUpdateGithubTextFile(
					env,
					installationId,
					owner,
					name,
					{
						content: input.content,
						message: input.message,
						path: input.path,
						sha: input.expectedSha,
					},
				)
				return { commitSha, contentSha, ok: true }
			} catch (error) {
				// GitHub refuses a write whose sha no longer matches the file.
				if (hasStatus(error, 409)) return { ok: false, reason: "stale-sha" }
				throw error
			}
		},
	}
}
