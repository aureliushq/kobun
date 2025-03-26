import { z } from 'zod'

// import type { COLLECTION_SLUG_REGEX } from '~/constants'

const CONTENT_FORMAT = z.enum(['md', 'mdx'])
export type ContentFormat = z.infer<typeof CONTENT_FORMAT>

const SINGLETON_FORMAT = z.literal('json')
export type SingletonFormat = z.infer<typeof SINGLETON_FORMAT>

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
	ARRAY = 'array',
	BOOLEAN = 'boolean',
	DATE = 'date',
	DOCUMENT = 'document',
	IMAGE = 'image',
	MULTISELECT = 'multiselect',
	OBJECT = 'object',
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

export type ObjectField = BasicField & {
	name?: HTMLInputElement['name']
	schema: ConfigSchema<SchemaKey>
	type: FieldTypes.OBJECT
}

export type ArrayField = BasicField & {
	name?: HTMLInputElement['name']
	field: Field
	itemLabel?: (props: {
		value: unknown
		fields?: Record<string, { value: unknown }>
	}) => string
	type: FieldTypes.ARRAY
}

export type Field =
	| ArrayField
	| BooleanField
	| DateField
	| DocumentField
	| ImageField
	| MultiSelectField
	| ObjectField
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

export type Collections = {
	[key: string]: Collection
}

// Singleton
export type Singleton = {
	features?: Features
	label: string
	paths: {
		assets?: AssetPath | string
		content: ContentPath | string
	}
	schema: ConfigSchema<SchemaKey>
}

export type Singletons = {
	[key: string]: Singleton
}

// Storage
// TODO: update cloud config properties
const R2_CREDENTIALS = z.object({
	accountId: z.string(),
	accessKeyId: z.string(),
	secretAccessKey: z.string(),
	bucketName: z.string(),
})
export type R2Credentials = z.infer<typeof R2_CREDENTIALS>

const ASSETS_R2_CONFIG = z.object({
	type: z.literal('r2'),
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
	format: z.object({
		collections: CONTENT_FORMAT,
		singletons: SINGLETON_FORMAT,
	}),
})

const R2_MODE = z.object({
	mode: z.literal('r2'),
	assets: ASSETS_R2_CONFIG.default({
		type: 'r2',
		prefix: 'assets',
	}).optional(),
	credentials: R2_CREDENTIALS.optional(),
	content: z
		.object({
			prefix: z.string(),
		})
		.default({
			prefix: 'content',
		})
		.optional(),
	format: z.object({
		collections: CONTENT_FORMAT,
		singletons: SINGLETON_FORMAT,
	}),
})

const STORAGE = z.discriminatedUnion('mode', [LOCAL_MODE, R2_MODE])
export type Storage = z.infer<typeof STORAGE>

// Configuration
export type Config = {
	adminAccess?: {
		disabled?: boolean
		redirectUrl?: string
	}
	basePath?: string
	collections: Collections
	singletons?: Singletons
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
		section: z.literal('create-collection-item'),
		collectionSlug: z.string(),
	}),
	z.object({
		section: z.literal('edit-collection-item'),
		collectionSlug: z.string(),
		id: z.string(),
	}),
	z.object({
		section: z.literal('edit-singleton'),
		singletonSlug: z.string(),
	}),
])
export type AdminPaths = z.infer<typeof ADMIN_PATHS>
