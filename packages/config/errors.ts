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
 * A parse error is about a file, and `validateConfig` is told the Format rather
 * than the path — so the path is filled in by whoever read the bytes. Both
 * writers of `configError` go through here, or the dashboard renders one of
 * them an empty filename (ADR-0003 amendment).
 */
export function scopeConfigErrors(
	errors: ConfigError[],
	path: string,
): ConfigError[] {
	return errors.map((error) =>
		error.code === "parse_error" && error.path === ""
			? { ...error, path }
			: error,
	)
}

/**
 * How the `configError` column spells a Config that read cleanly. Paired with
 * `parseConfigErrors` below so the writing and the reading of that column
 * cannot come to different conclusions about an empty one.
 */
export function storedConfigErrors(errors: ConfigError[]): string {
	return errors.length > 0 ? JSON.stringify(errors) : ""
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
