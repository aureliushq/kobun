import { createPrivateKey } from "node:crypto"
import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import type { InstallationID } from "@/types/github"

const GITHUB_HEADERS = {
	accept: "application/vnd.github+json",
	"x-github-api-version": "2022-11-28",
}

/**
 * Private keys stored as env vars have literal "\n" instead of newlines.
 * This restores them.
 *
 * GitHub generates PKCS#1 keys (BEGIN RSA PRIVATE KEY) but
 * @octokit/auth-app requires PKCS#8 (BEGIN PRIVATE KEY).
 * Convert automatically when needed.
 */
function getGithubAppPrivateKey(env: Env) {
	const pem = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n")

	if (pem.includes("BEGIN RSA PRIVATE KEY")) {
		const key = createPrivateKey(pem)
		return key.export({ type: "pkcs8", format: "pem" }) as string
	}

	return pem
}

/**
 * Create an Octokit authenticated as the GitHub App itself.
 * Use for app-level endpoints like GET /app/installations/{id}.
 */
export function getGithubAppOctokit(env: Env) {
	return new Octokit({
		authStrategy: createAppAuth,
		auth: {
			appId: env.GITHUB_APP_ID,
			privateKey: getGithubAppPrivateKey(env),
		},
		request: { fetch },
	})
}

/**
 * Create an Octokit authenticated as a specific installation.
 * Use for repo-level endpoints like GET /installation/repositories
 * or GET /repos/{owner}/{repo}/contents/{path}.
 *
 * Octokit automatically mints and caches short-lived installation tokens.
 */
export function getGithubInstallationOctokit(
	env: Env,
	installationId: InstallationID,
) {
	return new Octokit({
		authStrategy: createAppAuth,
		auth: {
			appId: env.GITHUB_APP_ID,
			privateKey: getGithubAppPrivateKey(env),
			installationId: Number(installationId),
		},
		request: { fetch },
	})
}

/**
 * Build the URL to send users to install the GitHub App.
 * Includes a one-time `state` param for anti-spoofing.
 */
export function getGithubAppInstallUrl(env: Env, state: string) {
	const url = new URL(
		`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
	)
	url.searchParams.set("state", state)
	return url.toString()
}

/**
 * Fetch installation details from GitHub using App auth.
 * Returns the full installation object including account info.
 */
export async function getGithubInstallation(
	env: Env,
	installationId: InstallationID,
) {
	const octokit = getGithubAppOctokit(env)
	const { data } = await octokit.request(
		"GET /app/installations/{installation_id}",
		{
			installation_id: Number(installationId),
			headers: GITHUB_HEADERS,
		},
	)
	return data
}

/**
 * List all repositories accessible to an installation.
 * Handles pagination automatically (100 per page).
 */
export async function listGithubInstallationRepositories(
	env: Env,
	installationId: InstallationID,
) {
	const octokit = getGithubInstallationOctokit(env, installationId)
	const repositories = []
	let page = 1

	while (true) {
		const { data } = await octokit.request("GET /installation/repositories", {
			per_page: 100,
			page,
			headers: GITHUB_HEADERS,
		})

		repositories.push(...data.repositories)

		if (data.repositories.length < 100) break
		page += 1
	}

	return repositories
}

/**
 * Read a single file's content from a repository.
 * Returns the decoded UTF-8 content, SHA, and path.
 */
export async function getGithubFileContent(
	env: Env,
	installationId: InstallationID,
	owner: string,
	repo: string,
	path: string,
	ref?: string,
) {
	const octokit = getGithubInstallationOctokit(env, installationId)

	const { data } = await octokit.repos.getContent({
		owner,
		repo,
		path,
		ref,
		headers: GITHUB_HEADERS,
	})

	if (Array.isArray(data) || data.type !== "file") {
		throw new Error(`Expected file at ${owner}/${repo}:${path}`)
	}

	return {
		sha: data.sha,
		path: data.path,
		content: atob(data.content),
	}
}
