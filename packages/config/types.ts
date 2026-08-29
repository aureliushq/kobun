import type z from "zod"
import type {
	arrayFieldSchema,
	booleanFieldSchema,
	collectionSchema,
	dateFieldSchema,
	datetimeFieldSchema,
	documentFieldSchema,
	featureSchema,
	fieldSchema,
	imageFieldSchema,
	kobunConfigSchema,
	multiSelectFieldSchema,
	objectFieldSchema,
	selectFieldSchema,
	selectOptionSchema,
	singletonSchema,
	slugFieldSchema,
	textFieldSchema,
	urlFieldSchema,
} from "./schema"

////////////////////// FIELD TYPES //////////////////////
export type ArrayField = z.infer<typeof arrayFieldSchema>
export type BooleanField = z.infer<typeof booleanFieldSchema>
export type DateField = z.infer<typeof dateFieldSchema>
export type DatetimeField = z.infer<typeof datetimeFieldSchema>
export type DocumentField = z.infer<typeof documentFieldSchema>
export type ImageField = z.infer<typeof imageFieldSchema>
export type MultiSelectField = z.infer<typeof multiSelectFieldSchema>
export type ObjectField = z.infer<typeof objectFieldSchema>
export type SelectField = z.infer<typeof selectFieldSchema>
export type SelectOption = z.infer<typeof selectOptionSchema>
export type SlugField = z.infer<typeof slugFieldSchema>
export type TextField = z.infer<typeof textFieldSchema>
export type UrlField = z.infer<typeof urlFieldSchema>
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
 * `field.managed` outright — the read-only branch has to be checked before the
 * Field Type dispatch (ADR-0005), and a union would make that a narrowing dance
 * at every dispatch site.
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
export type Collection = Omit<AuthoredCollection, "schema"> & {
	schema: Record<string, ResolvedField>
}

/**
 * A Singleton has no resolved form yet: Features are rejected there, so its
 * schema is exactly what its Config declares. Lifting that rejection (#95) is
 * what gives a Singleton Managed Fields to resolve.
 */
export type Singleton = z.infer<typeof singletonSchema>

/**
 * How a Source's bytes encode its Content Document: `md`, `mdx`, `json`, or
 * `yaml`. This is the type consumers outside the package use; `schema.ts` keeps
 * a private `Format` enum of the same four values for building the schema.
 *
 * Derived from that schema so it can never drift, but widened through a
 * template literal: the enum is private, so without the widening a caller
 * outside this package could not write `"md"`.
 */
export type Format = `${Collection["format"]}`

////////////////////// CONFIGURATION TYPES //////////////////////
export type KobunConfig = z.infer<typeof kobunConfigSchema>

export type NormalizedConfig = {
	basePath: string
	collections: Record<string, Collection>
	errors: ConfigError[]
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
