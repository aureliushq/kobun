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
export enum FieldTypes {
	BOOLEAN = 'boolean',
	DATE = 'date',
	DOCUMENT = 'document',
	IMAGE = 'image',
	MULTISELECT = 'multiselect',
	PUBLISH = 'publish',
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
}

export type DateField = BasicField

export type DocumentField = BasicField

type SelectOptions = {
	value: string
	label: string
}

export type SelectField = BasicField & {
	options: SelectOptions[]
	placeholder?: string
}

export type SlugField = {
	title?: { key: SchemaKey }
} & Omit<TextField, 'multiline' | 'type'>

export type TextField = BasicField & {
	multiline?: boolean
	placeholder?: string
	type?: HTMLInputElement['type']
}

export type UrlField = BasicField & {
	placeholder?: string
	type?: HTMLInputElement['type']
}

export type Field =
	| BooleanField
	| DateField
	| DocumentField
	| SlugField
	| TextField
	| UrlField

type BuiltinSchemaKeys = 'createdAt' | 'publishedAt' | 'updatedAt'
type SpecialSchemaKeys = 'content' | 'slug' | 'title'
export type SchemaKey = BuiltinSchemaKeys | SpecialSchemaKeys | string
export type Schema<T extends SchemaKey> = Record<T, Field>

type CollectionSlug = z.infer<typeof COLLECTION_SLUG_REGEX>

export type Collection = {
	features?: Features
	label: string
	paths: {
		assets?: AssetPath | string
		content: ContentPath | string
	}
	schema: Schema<SchemaKey>
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
