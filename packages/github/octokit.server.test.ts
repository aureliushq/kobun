import { expect, test } from "vitest"
import {
	getGithubAppOctokit,
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
