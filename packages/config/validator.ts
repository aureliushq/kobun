import YAML from "yaml"
import type z from "zod"
import { collectionSchema, singletonSchema, versionSchema } from "./schema"
import type {
	Collection,
	ConfigError,
	NormalizedConfig,
	ParseResult,
	Singleton,
} from "./types"

export const validateConfig = (
	raw: string,
	format: "json" | "yaml",
): ParseResult => {
	let parsed: unknown
	try {
		parsed = format === "json" ? JSON.parse(raw) : YAML.parse(raw)
	} catch (error) {
		return {
			config: null,
			errors: [{ code: "parse_error", message: String(error), path: "" }],
		}
	}

	const parsedRaw = parsed as Record<string, unknown>
	const errors: ConfigError[] = []

	// basePath: optional, defaults to "src/content"
	const basePath =
		typeof parsedRaw.basePath === "string" ? parsedRaw.basePath : "src/content"

	// collections: required object
	const collections: Record<string, Collection> = {}
	const rawCollections = parsedRaw.collections
	if (typeof rawCollections === "object" && rawCollections !== null) {
		for (const [key, value] of Object.entries(
			rawCollections as Record<string, unknown>,
		)) {
			const result = collectionSchema.safeParse(value)
			if (!result.success) {
				errors.push(
					...zodIssuesToConfigError(result.error.issues, `collections.${key}`),
				)
			} else {
				collections[key] = result.data
			}
		}
	} else if (rawCollections === undefined) {
		errors.push({
			code: "missing_required",
			message: "collections is required",
			path: "collections",
		})
	}

	// singletons: optional object
	const singletons: Record<string, Singleton> = {}
	const rawSingletons = parsedRaw.singletons
	if (typeof rawSingletons === "object" && rawSingletons !== null) {
		for (const [key, value] of Object.entries(
			rawSingletons as Record<string, unknown>,
		)) {
			const result = singletonSchema.safeParse(value)
			if (!result.success) {
				errors.push(
					...zodIssuesToConfigError(result.error.issues, `singletons.${key}`),
				)
			} else {
				singletons[key] = result.data
			}
		}
	}

	// version: required number
	const version = parsedRaw.version
	const versionResult = versionSchema.safeParse(version)
	if (!versionResult.success) {
		versionResult.error.issues.forEach((issue) => {
			errors.push({
				code: issue.code,
				message: issue.message,
				path: issue.path.join("."),
			})
		})
	}

	const hasAnything =
		Object.keys(collections).length > 0 || Object.keys(singletons).length > 0

	const config: NormalizedConfig | null = hasAnything
		? {
				basePath,
				collections,
				errors,
				singletons,
				version: versionResult.success ? versionResult.data : 0,
			}
		: null

	return {
		config,
		errors,
	}
}

const zodIssuesToConfigError = (
	issues: z.ZodIssue[],
	prefix: string,
): ConfigError[] => {
	return issues.map((issue) => {
		const fullPath = [prefix, ...issue.path]
			.filter((segment) => segment !== "") // remove empty segments
			.join(".")

		return {
			code: issue.code,
			message: issue.message,
			path: fullPath,
		}
	})
}
