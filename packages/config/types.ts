import type z from "zod"
import type {
	arrayFieldSchema,
	booleanFieldSchema,
	collectionSchema,
	dateFieldSchema,
	documentFieldSchema,
	featureSchema,
	fieldSchema,
	imageFieldSchema,
	kobunConfigSchema,
	multiSelectFieldSchema,
	objectFieldSchema,
	selectFieldSchema,
	singletonSchema,
	slugFieldSchema,
	textFieldSchema,
	urlFieldSchema,
} from "./schema"

////////////////////// FIELD TYPES //////////////////////
export type ArrayField = z.infer<typeof arrayFieldSchema>
export type BooleanField = z.infer<typeof booleanFieldSchema>
export type DateField = z.infer<typeof dateFieldSchema>
export type DocumentField = z.infer<typeof documentFieldSchema>
export type ImageField = z.infer<typeof imageFieldSchema>
export type MultiSelectField = z.infer<typeof multiSelectFieldSchema>
export type ObjectField = z.infer<typeof objectFieldSchema>
export type SelectField = z.infer<typeof selectFieldSchema>
export type SlugField = z.infer<typeof slugFieldSchema>
export type TextField = z.infer<typeof textFieldSchema>
export type UrlField = z.infer<typeof urlFieldSchema>
export type Field = z.infer<typeof fieldSchema>

////////////////////// COLLECTION, FEATURES, SINGLETON TYPES //////////////////////
export type Collection = z.infer<typeof collectionSchema>
export type Features = z.infer<typeof featureSchema>
export type Singleton = z.infer<typeof singletonSchema>

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
