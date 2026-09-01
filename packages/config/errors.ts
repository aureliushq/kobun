import type { ConfigError } from "./types"

/**
 * The one Config error nothing parsed: no file at any of `CONFIG_PATHS`. Named
 * here because the fetch that discovers it and the dashboard that reports it
 * are different modules, and a message spelled out in both drifts.
 */
export const NO_CONFIG_ERROR: ConfigError = {
	code: "no_config",
	message:
		"No configuration file found at repository root. Expected .kobun.json, .kobun.yml, or .kobun.yaml.",
	path: "",
}

/**
 * The errors a sync stored on a Project row. This app writes that column, so
 * the only shape worth guarding against is the one a row written by an older
 * version — or by nothing at all — holds.
 */
export function parseConfigErrors(stored: string | null): ConfigError[] {
	if (!stored) return []

	try {
		const parsed = JSON.parse(stored)
		return Array.isArray(parsed) ? (parsed as ConfigError[]) : []
	} catch {
		return []
	}
}
