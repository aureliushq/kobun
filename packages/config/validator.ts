import YAML from "yaml"
import type z from "zod"
import { expandFeatures } from "./features"
import { collectionSchema, singletonSchema, versionSchema } from "./schema"
import type {
	Collection,
	ConfigError,
	NormalizedConfig,
	ParseResult,
	Singleton,
} from "./types"

/**
 * How a Config file's bytes are encoded, from where it lives. Shared so the
 * cache and the dashboard sync cannot come to different conclusions about the
 * same file — a Format is a property of the Source, not of who is reading it.
 */
export const configFileFormat = (path: string): "json" | "yaml" =>
	path.endsWith(".json") ? "json" : "yaml"

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

	// A YAML document that is empty, or holds only comments, parses to `null`,
	// and a file holding a bare scalar parses to one — neither is a Config, and
	// reading a key off the first throws.
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return {
			config: null,
			errors: [
				{
					code: "parse_error",
					message: "Configuration file is empty or is not an object.",
					path: "",
				},
			],
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
				continue
			}

			const expanded = expandFeatures(result.data)
			if (!expanded.collection) {
				errors.push(
					...expanded.errors.map((error) => ({
						...error,
						path: scopePath(`collections.${key}`, error.path),
					})),
				)
				continue
			}

			collections[key] = expanded.collection
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
				continue
			}

			// `featureSchema` hangs off `singletonSchema` and always has, but the
			// singleton write path is a stub — expanding here would mint Managed
			// Fields empty by construction, forever (ADR-0005). A loud error beats
			// permanent silence, and it lasts only as long as its reason does.
			if (result.data.features) {
				errors.push({
					code: "feature_unsupported",
					message:
						"Features are not supported on Singletons yet. Remove the features block.",
					path: `singletons.${key}.features`,
				})
				continue
			}

			singletons[key] = result.data
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

	// A Config declaring an empty `collections` map is refused like any other
	// that declares nothing — and until now it was the one way to be refused
	// with nothing said, which left the dashboard inventing a reason.
	if (!hasAnything && errors.length === 0) {
		errors.push({
			code: "no_collections",
			message:
				"Configuration declares no collections and no singletons. Declare at least one.",
			path: "collections",
		})
	}

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

/** A dotted error path, with empty segments dropped. */
const scopePath = (...segments: PropertyKey[]): string =>
	segments.filter((segment) => segment !== "").join(".")

const zodIssuesToConfigError = (
	issues: z.ZodIssue[],
	prefix: string,
): ConfigError[] => {
	return issues.map((issue) => ({
		code: issue.code,
		message: issue.message,
		path: scopePath(prefix, ...issue.path),
	}))
}
