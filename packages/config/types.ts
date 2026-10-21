import type z from "zod"
import type {
	arrayFieldSchema,
	collectionSchema,
	documentFieldSchema,
	featureSchema,
	fieldSchema,
	multiSelectFieldSchema,
	selectFieldSchema,
	selectOptionSchema,
	singletonSchema,
	slugFieldSchema,
} from "./schema"

////////////////////// FIELD TYPES //////////////////////
export type ArrayField = z.infer<typeof arrayFieldSchema>
export type DocumentField = z.infer<typeof documentFieldSchema>
export type MultiSelectField = z.infer<typeof multiSelectFieldSchema>
export type SelectField = z.infer<typeof selectFieldSchema>
export type SelectOption = z.infer<typeof selectOptionSchema>
export type SlugField = z.infer<typeof slugFieldSchema>
export type Field = z.infer<typeof fieldSchema>

/**
 * A Field a Feature contributed, marked as owned by the system. The marker is
 * the config layer's own output, never authored vocabulary: it is absent from
 * `fieldSchema` on purpose, so the published JSON Schema keeps describing the
 * authored shape (ADR-0005) and a Config that writes `managed` itself has it
 * stripped by Zod like any other unknown key.
 */
export type ManagedField = Field & { managed: true }

/**
 * A Field in a resolved schema: authored by the writer, or contributed by a
 * Feature. The marker is optional rather than a union arm so a consumer can ask
 * `field.managed` outright — the editor partitions its properties panel on it
 * (ADR-0005), and a union would make that a narrowing dance at a site that only
 * wants to sort Fields into two lists. A Managed Field is editable like any
 * other, so the marker never reaches the Field Type dispatch as a branch.
 */
export type ResolvedField = Field & { managed?: true }

////////////////////// COLLECTION, FEATURES, SINGLETON TYPES //////////////////////
export type Features = z.infer<typeof featureSchema>

/**
 * A Collection exactly as its Config declares it, before Features expand. Only
 * the config layer sees this shape; everything downstream of `validateConfig`
 * gets the resolved `Collection` below.
 */
export type AuthoredCollection = z.infer<typeof collectionSchema>

/**
 * A Collection as the app sees it: the authored Fields plus whatever Managed
 * Fields its Features contributed. `Collection` names the resolved shape rather
 * than the authored one because resolved is what every consumer holds.
 */
export type Collection = Omit<
	AuthoredCollection,
	"schema" | "subcollections"
> & {
	schema: Record<string, ResolvedField>
	subcollections?: Record<string, Subcollection>
}

/**
 * A Collection declared on a Collection: each Parent Item owns its own set of
 * its items. Declared and resolved like a Collection, but one level only.
 */
export type Subcollection = Omit<Collection, "subcollections">

/** A Singleton exactly as its Config declares it, before Features expand. */
export type AuthoredSingleton = z.infer<typeof singletonSchema>

/**
 * A Singleton as the app sees it: the authored Fields plus whatever Managed
 * Fields its Features contributed, resolved as a Collection's are.
 */
export type Singleton = Omit<AuthoredSingleton, "schema" | "subcollections"> & {
	schema: Record<string, ResolvedField>
}

/**
 * How a Source's bytes encode its Content Document: `md`, `mdx`, `json`, or
 * `yaml`.
 */
export type Format = Collection["format"]

////////////////////// CONFIGURATION TYPES //////////////////////
export type NormalizedConfig = {
	basePath: string
	collections: Record<string, Collection>
	errors: ConfigError[]
	/** Where committed images are written, as a repository path. */
	mediaPath: string
	/** What the committed Markdown links images by: a path on the site. */
	mediaUrl: string
	singletons: Record<string, Singleton>
	version: number
}

////////////////////// ERROR & RESULT TYPES //////////////////////
export type ConfigError = {
	code: string
	message: string
	path: string
}

export type ParseResult = {
	config: NormalizedConfig | null
	errors: ConfigError[]
}

/** A JSON-style object: not null, not an array. */
export const isPlainObject = (
	value: unknown,
): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value)
