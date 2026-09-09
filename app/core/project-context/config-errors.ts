import { NO_CONFIG_ERROR, parseConfigErrors } from "@/config/errors"
import type { ConfigError, NormalizedConfig } from "@/config/types"
import type { ConfigProblem } from "./types"

/**
 * A repository the resolver could not reach, which is not the same as a file it
 * could not read. It gets its own arm rather than falling through to "Invalid
 * config", which would tell a writer whose Config is fine that it is not.
 */
export const UNREADABLE_CONFIG = "unreadable_config"

const UNREADABLE_CONFIG_ERROR: ConfigError = {
	code: UNREADABLE_CONFIG,
	message:
		"Kobun could not reach or read this repository's configuration. Refresh the configuration to try again.",
	path: "",
}

/**
 * What is left to say about a Config kobun did read and could not use, when the
 * row holds no list of what was wrong with it. Only a Project connected before
 * the cache began storing that list gets here.
 */
const INVALID_CONFIG_ERROR: ConfigError = {
	code: "invalid_config",
	message:
		"This repository's configuration could not be used. Refresh the configuration to see what is wrong with it.",
	path: "",
}

/**
 * What to tell a writer whose Project resolved without a Config (ADR-0007).
 * Both writers of `configError` — the sync, and the Config cache every
 * navigation resolves through — leave behind what they last found, and the
 * alerts already know how to render one, so the stored list is what this
 * returns.
 *
 * The two cases it does not read that column for: a repository nothing could be
 * read from, where the column describes some earlier visit rather than this
 * one, and a row written before either writer stored anything.
 */
export function configProblemErrors(
	problem: ConfigProblem,
	stored: string | null,
): ConfigError[] {
	if (problem === "config-unreadable") return [UNREADABLE_CONFIG_ERROR]

	const errors = parseConfigErrors(stored)
	if (errors.length > 0) return errors

	return [problem === "config-missing" ? NO_CONFIG_ERROR : INVALID_CONFIG_ERROR]
}

/**
 * Everything wrong with a Project's Config, whether or not one was served.
 *
 * A Config that resolved carries its own errors — it is served even when parts
 * of it did not validate, so the writer keeps the pages Kobun could read. One
 * that did not resolve is described from the Project row instead. Both the
 * dashboard and the Project's settings page ask this question, and a Config
 * that reads as broken on one page must not read as fine on the other.
 */
export function configErrors(
	config: NormalizedConfig | null,
	problem: ConfigProblem | null,
	stored: string | null,
): ConfigError[] {
	if (problem) return configProblemErrors(problem, stored)
	return config?.errors ?? []
}
