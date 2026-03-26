import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import invariant from "tiny-invariant"
import * as schema from "@/db/schema"
import { ConfigStatus, type Project, ProjectStatus } from "@/db/types"
import { getGithubFileContent } from "@/github/octokit.server"
import type { InstallationID } from "@/types/github"
import { CONFIG_PATHS } from "@/ui/lib/constants"
import type { ConfigError, NormalizedConfig } from "./types"
import { validateConfig } from "./validator"

export type ConfigFetchResult = {
	config: NormalizedConfig | null
	errors: ConfigError[]
	filePath: string | null
	sha: string | null
}

export const deriveConfigStatus = (result: ConfigFetchResult): ConfigStatus => {
	if (result.config !== null) return ConfigStatus.PRESENT
	if (result.errors.some((e) => e.code === "no_config"))
		return ConfigStatus.MISSING
	return ConfigStatus.ERROR
}

export const fetchAndParseConfig = async (
	env: Env,
	installationId: InstallationID,
	owner: string,
	repo: string,
): Promise<ConfigFetchResult> => {
	for (const path of CONFIG_PATHS) {
		try {
			const file = await getGithubFileContent(
				env,
				installationId,
				owner,
				repo,
				path,
			)
			const format = path.endsWith(".json") ? "json" : "yaml"
			const result = validateConfig(file.content, format)
			return { ...result, filePath: path, sha: file.sha }
		} catch (error) {
			if (error instanceof Error && "status" in error && error.status === 404) {
			} else {
				return {
					config: null,
					errors: [{ code: "parse_error", message: String(error), path: path }],
					filePath: path,
					sha: null,
				}
			}
		}
	}

	return {
		config: null,
		errors: [
			{
				code: "no_config",
				message:
					"No configuration file found at repository root. Expected .kobun.json, .kobun.yml, or .kobun.yaml.",
				path: "",
			},
		],
		filePath: null,
		sha: null,
	}
}

export const syncProjectConfig = async (
	db: DrizzleD1Database<typeof schema>,
	env: Env,
	project: Project,
): Promise<Project> => {
	const installation = await db.query.githubInstallation.findFirst({
		where: eq(schema.githubInstallation.id, project.installationId),
	})
	invariant(installation, "installation not found")

	const configResult = await fetchAndParseConfig(
		env,
		installation.githubInstallationId,
		project.repoOwnerLogin,
		project.repoName,
	)
	const configStatus = deriveConfigStatus(configResult)

	invariant(project.id, "project id is required")

	const [updatedProject] = await db
		.update(schema.project)
		.set({
			configCheckedAt: new Date(),
			configData: JSON.stringify(configResult.config),
			configError:
				configResult.errors.length > 0
					? JSON.stringify(configResult.errors)
					: "",
			configPath: configResult.filePath ?? ".kobun.json",
			configSha: configResult.sha,
			configStatus,
			status: ProjectStatus.ACTIVE,
		})
		.where(eq(schema.project.id, project.id))
		.returning()

	return updatedProject
}
