import {
	createOrUpdateGithubTextFile,
	listGithubDirectoryFiles,
} from "@/github/octokit.server"
import type { InstallationID } from "@/types/github"
import type {
	SourceStore,
	SourceWriteInput,
	SourceWriteResult,
} from "./source-store"

function hasStatus(error: unknown, status: number) {
	return error instanceof Error && "status" in error && error.status === status
}

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
		list: async (path: string) => {
			try {
				return await listGithubDirectoryFiles(
					env,
					installationId,
					owner,
					name,
					path,
				)
			} catch (error) {
				// A collection whose directory does not exist yet simply has no files.
				if (hasStatus(error, 404)) return []
				throw error
			}
		},
		write: async (input: SourceWriteInput): Promise<SourceWriteResult> => {
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
