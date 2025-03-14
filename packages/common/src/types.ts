import { z } from 'zod'

// import type { COLLECTION_SLUG_REGEX } from '~/constants'

const CONTENT_FORMAT = z.enum(['md', 'mdx'])
export type ContentFormat = z.infer<typeof CONTENT_FORMAT>

type Glob = '*' | '**'
type Path = `${string}/${Glob}` | `${string}/${Glob}/${string}`
export type AssetPath = Path
export type ContentPath = Path

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
	name?: HTMLInputElement['name']
	type: FieldTypes.BOOLEAN
}

export type DateField = BasicField & {
	name?: HTMLInputElement['name']
	type: FieldTypes.DATE
}

export type DocumentField = BasicField & {
	name?: HTMLInputElement['name']
	type: FieldTypes.DOCUMENT
}

export type ImageField = BasicField & {
	name?: HTMLInputElement['name']
	type: FieldTypes.IMAGE
}

export type SelectOption = {
	value: string
	label: string
}

export type MultiSelectField = BasicField & {
	defaultOptions?: string[]
	name?: HTMLInputElement['name']
	options: SelectOption[]
	placeholder?: string
	type: FieldTypes.MULTISELECT
}

export type SelectField = BasicField & {
	defaultOption?: string
	name?: HTMLInputElement['name']
	options: SelectOption[]
	placeholder?: string
	type: FieldTypes.SELECT
}

// TODO: allow using variables for constructing slugs
export type SlugField = BasicField & {
	name?: HTMLInputElement['name']
	placeholder?: string
	title?: { key: SchemaKey }
	type: FieldTypes.SLUG
}

export type TextField = BasicField & {
	htmlType?: HTMLInputElement['type']
	multiline?: boolean
	name?: HTMLInputElement['name']
	placeholder?: string
	type: FieldTypes.TEXT
}

export type UrlField = BasicField & {
	htmlType?: HTMLInputElement['type']
	name?: HTMLInputElement['name']
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

export type ConfigSchema<T extends SchemaKey> = Record<T, Field>

// type CollectionSlug = z.infer<typeof COLLECTION_SLUG_REGEX>

export type Collection = {
	features?: Features
	label: string
	paths: {
		assets?: AssetPath | string
		content: ContentPath | string
	}
	schema: ConfigSchema<SchemaKey>
	// slug: CollectionSlug
}

export interface Collections {
	[key: string]: Collection
}

// Storage
// TODO: update cloud config properties
const R2_CREDENTIALS = z.object({
	accountId: z.string(),
	accessKeyId: z.string(),
	secretAccessKey: z.string(),
	bucketName: z.string(),
})

const ASSETS_R2_CONFIG = z.object({
	type: z.literal('r2'),
	credentials: R2_CREDENTIALS,
	prefix: z.string().default('assets'),
})

const ASSETS_LOCAL_CONFIG = z.object({
	type: z.literal('local'),
	prefix: z.string(),
})

const ASSETS_CONFIG = z.union([ASSETS_R2_CONFIG, ASSETS_LOCAL_CONFIG])

const LOCAL_MODE = z.object({
	mode: z.literal('local'),
	assets: ASSETS_CONFIG.default({
		type: 'local',
		prefix: 'public/assets',
	}).optional(),
	content: z
		.object({
			prefix: z.string(),
		})
		.default({
			prefix: 'app/content',
		})
		.optional(),
	format: CONTENT_FORMAT,
})

const R2_MODE = z.object({
	mode: z.literal('r2'),
	assets: ASSETS_R2_CONFIG.default({
		type: 'r2',
		prefix: 'assets',
		credentials: z.NEVER,
	}).optional(),
	content: z
		.object({
			prefix: z.string(),
		})
		.default({
			prefix: 'content',
		})
		.optional(),
	credentials: R2_CREDENTIALS,
	format: CONTENT_FORMAT,
})

const STORAGE = z.discriminatedUnion('mode', [LOCAL_MODE, R2_MODE])

export type Storage = z.infer<typeof STORAGE>

// Configuration
export type Config = {
	basePath?: string
	collections: Collections
	storage: Storage
}

const ADMIN_PATHS = z.discriminatedUnion('section', [
	z.object({ section: z.literal('root') }),
	z.object({ section: z.literal('settings') }),
	z.object({
		section: z.literal('collections'),
		collectionSlug: z.string(),
		search: z.record(z.string(), z.string()).optional(),
	}),
	z.object({
		section: z.literal('editor-create'),
		collectionSlug: z.string(),
	}),
	z.object({
		section: z.literal('editor-edit'),
		collectionSlug: z.string(),
		id: z.string(),
	}),
])
export type AdminPaths = z.infer<typeof ADMIN_PATHS>
