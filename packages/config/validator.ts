import YAML from "yaml"
import z from "zod"
import { expandFeatures } from "./features"
import {
	collectionSchema,
	singletonSchema,
	subcollectionSchema,
	versionSchema,
} from "./schema"
import {
	type Collection,
	type ConfigError,
	type Features,
	type Field,
	isPlainObject,
	type NormalizedConfig,
	type ParseResult,
	type Singleton,
	type Subcollection,
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

	// mediaPath: optional, defaults to "src/assets/images". Committed images are
	// linked by their repository path, which has no leading slash: one with a
	// slash is a path on the site, and the editor would not look in the repo.
	const mediaPath = (
		typeof parsedRaw.mediaPath === "string"
			? parsedRaw.mediaPath
			: "src/assets/images"
	).replace(/^\/+|\/+$/g, "")

	// mediaUrl: optional, defaults to mediaPath. The link the committed Markdown
	// uses, for a site that serves the media directory somewhere else — a
	// `public/images` served at `/images`. Its leading slash is kept: it is a
	// path on the site, not in the repository.
	const mediaUrl =
		typeof parsedRaw.mediaUrl === "string"
			? parsedRaw.mediaUrl.replace(/\/+$/, "")
			: mediaPath

	// collections: required object
	const collections: Record<string, Collection> = {}
	const rawCollections = parsedRaw.collections
	if (typeof rawCollections === "object" && rawCollections !== null) {
		for (const [key, value] of Object.entries(
			rawCollections as Record<string, unknown>,
		)) {
			// A bad Subcollection must not sink its Parent, so the Parent is
			// validated without them and each is resolved on its own.
			const { subcollections: rawSubcollections, ...parent } = isPlainObject(
				value,
			)
				? value
				: {}
			const prefix = `collections.${key}`
			const collection = resolveEntry(
				isPlainObject(value) ? parent : value,
				collectionSchema,
				prefix,
				errors,
			)
			if (!collection) continue

			collections[key] =
				rawSubcollections === undefined
					? collection
					: {
							...collection,
							subcollections: resolveSubcollections(
								rawSubcollections,
								`${prefix}.subcollections`,
								errors,
							),
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
			const singleton = resolveEntry(
				value,
				singletonSchema,
				`singletons.${key}`,
				errors,
			)
			if (singleton) singletons[key] = singleton
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
				mediaPath,
				mediaUrl,
				singletons,
				version: versionResult.success ? versionResult.data : 0,
			}
		: null

	return {
		config,
		errors,
	}
}

/**
 * One Collection, Singleton or Subcollection, validated and with its Features
 * expanded, or `null` with its errors pushed, scoped to `prefix`.
 */
const resolveEntry = <
	Authored extends { features?: Features; schema: Record<string, Field> },
>(
	value: unknown,
	schema: z.ZodType<Authored>,
	prefix: string,
	errors: ConfigError[],
) => {
	const result = schema.safeParse(value)
	if (!result.success) {
		errors.push(...zodIssuesToConfigError(result.error.issues, prefix))
		return null
	}

	const expanded = expandFeatures(result.data)
	errors.push(
		...expanded.errors.map((error) => ({
			...error,
			path: scopePath(prefix, error.path),
		})),
	)
	return expanded.resolved
}

const resolveSubcollections = (
	raw: unknown,
	prefix: string,
	errors: ConfigError[],
): Record<string, Subcollection> => {
	const subcollections: Record<string, Subcollection> = {}
	const result = z.record(z.string(), z.unknown()).safeParse(raw)
	if (!result.success) {
		errors.push(...zodIssuesToConfigError(result.error.issues, prefix))
		return subcollections
	}

	for (const [key, value] of Object.entries(result.data)) {
		const subcollection = resolveEntry(
			value,
			subcollectionSchema,
			`${prefix}.${key}`,
			errors,
		)
		if (subcollection) subcollections[key] = subcollection
	}
	return subcollections
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
