import { z } from 'zod'

import type { COLLECTION_SLUG_REGEX } from '~/constants'

const CONTENT_FORMAT = z.enum(['md', 'mdx'])
export type ContentFormat = z.infer<typeof CONTENT_FORMAT>

type Glob = '*' | '**'
type Path = `${string}/${Glob}` | `${string}/${Glob}/${string}`
type AssetPath = Path
type ContentPath = Path

export type Features = {
	featured?: {
		limit: number
	}
	publish?: boolean
	timestamps?: {
		createdAt?: boolean
		updatedAt?: boolean
	}
}

// Collection
type BuiltinSchemaKeys = 'createdAt' | 'updatedAt'
type SpecialSchemaKeys = 'content' | 'slug' | 'title'
export type SchemaKey = SpecialSchemaKeys | string

export enum FieldTypes {
	BOOLEAN = 'boolean',
	DATE = 'date',
	DOCUMENT = 'document',
	IMAGE = 'image',
	MULTISELECT = 'multiselect',
	SELECT = 'select',
	SLUG = 'slug',
	TEXT = 'text',
	URL = 'url',
}

type BasicField = {
	label: string
	description?: string
}

export type BooleanField = BasicField & {
	component?: 'checkbox' | 'switch'
	defaultChecked?: boolean
	type: FieldTypes.BOOLEAN
}

export type DateField = BasicField & {
	type: FieldTypes.DATE
}

export type DocumentField = BasicField & {
	type: FieldTypes.DOCUMENT
}

export type ImageField = BasicField & {
	type: FieldTypes.IMAGE
}

type SelectOption = {
	value: string
	label: string
}

export type MultiSelectField = BasicField & {
	options: SelectOption[]
	placeholder?: string
	type: FieldTypes.MULTISELECT
}

export type SelectField = BasicField & {
	options: SelectOption[]
	placeholder?: string
	type: FieldTypes.SELECT
}

export type SlugField = BasicField & {
	title?: { key: SchemaKey }
	type: FieldTypes.SLUG
}

export type TextField = BasicField & {
	htmlType?: HTMLInputElement['type']
	multiline?: boolean
	placeholder?: string
	type: FieldTypes.TEXT
}

export type UrlField = BasicField & {
	htmlType?: HTMLInputElement['type']
	placeholder?: string
	type: FieldTypes.URL
}

export type Field =
	| BooleanField
	| DateField
	| DocumentField
	| ImageField
	| MultiSelectField
	| SelectField
	| SlugField
	| TextField
	| UrlField

type FieldTypeToValue = {
	[FieldTypes.BOOLEAN]: boolean
	[FieldTypes.DATE]: Date
	[FieldTypes.DOCUMENT]: string
	[FieldTypes.IMAGE]: string
	[FieldTypes.MULTISELECT]: SelectOption[]
	[FieldTypes.SELECT]: SelectOption
	[FieldTypes.SLUG]: string
	[FieldTypes.TEXT]: string
	[FieldTypes.URL]: string
}

type InferFieldValue<F extends Field> = FieldTypeToValue[F['type']]

export type ConfigSchema<T extends SchemaKey> = Record<T, Field>

type InferSchemaType<T extends ConfigSchema<SchemaKey>> = {
	[K in keyof T]: InferFieldValue<T[K]>
} & {
	[K in BuiltinSchemaKeys]: Date
} & ({ status: 'draft' } | { publishedAt: Date; status: 'published' })

type CollectionSlug = z.infer<typeof COLLECTION_SLUG_REGEX>

export type Collection = {
	features?: Features
	label: string
	paths: {
		assets?: AssetPath | string
		content: ContentPath | string
	}
	schema: ConfigSchema<SchemaKey>
	slug: CollectionSlug
}

export interface Collections {
	[key: string]: Collection
}

// Storage
// TODO: update cloud config properties
const ASSETS_CLOUD_CONFIG = z.object({
	type: z.enum(['r2', 's3']),
	accessKey: z.string(),
	secretKey: z.string(),
	region: z.string(),
	bucketName: z.string(),
})

const ASSETS_LOCAL_CONFIG = z.string()

const ASSETS_CONFIG = z.union([ASSETS_CLOUD_CONFIG, ASSETS_LOCAL_CONFIG])

const LOCAL_MODE = z.object({
	format: CONTENT_FORMAT,
	mode: z.literal('local'),
	// TODO: add validation for assets and content paths
	assets: ASSETS_CONFIG.optional(),
	content: z.string().optional(),
})

const CLOUD_MODE = z.object({
	mode: z.literal('cloud'),
	assets: ASSETS_CONFIG,
	// TODO: dsn can be a string or an object
	content: z.object({ dsn: z.string() }),
})

const STORAGE = z.discriminatedUnion('mode', [LOCAL_MODE, CLOUD_MODE])

export type Storage = z.infer<typeof STORAGE>

// Configuration
export type Config = {
	basePath?: string
	collections: Collections
	storage: Storage
}
