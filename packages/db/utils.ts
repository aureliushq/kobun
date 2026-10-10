import { existsSync, globSync } from "node:fs"
import wranglerConfig from "../../wrangler.json"

function getLocalSqliteDbUrl() {
	const dbUrls = globSync("./.wrangler/state/v3/d1/**/*.sqlite").filter(
		(file) => !file.endsWith("/metadata.sqlite"),
	)

	if (dbUrls.length > 1) {
		throw new Error("Multiple SQLite databases found")
	}

	if (dbUrls.length === 0) {
		throw new Error("No SQLite databases found")
	}

	return dbUrls[0]
}

function isValidCloudflareEnv(
	value?: string,
): value is keyof typeof wranglerConfig.env {
	return !!value && value in wranglerConfig.env
}

function getDatabaseId(cloudflareEnv?: string) {
	if (
		isValidCloudflareEnv(cloudflareEnv) &&
		["production", "preview"].includes(cloudflareEnv)
	) {
		return wranglerConfig.env[cloudflareEnv].d1_databases[0].database_id
	}

	return wranglerConfig.d1_databases[0].database_id
}

export function getDbCredentials() {
	if (existsSync(".env")) process.loadEnvFile()

	const isRemote =
		isValidCloudflareEnv(process.env.CLOUDFLARE_ENV) &&
		["production", "preview"].includes(process.env.CLOUDFLARE_ENV)

	const databaseId = getDatabaseId(process.env.CLOUDFLARE_ENV)

	if (isRemote) {
		return {
			driver: "d1-http",
			dbCredentials: {
				accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
				token: process.env.CLOUDFLARE_API_TOKEN,
				databaseId,
			},
		}
	}

	return {
		dbCredentials: {
			url: getLocalSqliteDbUrl(),
		},
	}
}
