import { z } from 'zod'
import type { COLLECTION_SLUG_REGEX } from './lib/constants'

type CollectionFormat = 'md' | 'mdx'

type Glob = '*' | '**'
type ContentPath = `${string}/${Glob}` | `${string}/${Glob}/${string}`

export const FieldTypes = z.enum([
	'boolean',
	'date',
	'document',
	'image',
	'multiselect',
	'select',
	'slug',
	'text',
	'url',
])

type BasicField = {
	label: string
	description?: string
}

export type BooleanField = BasicField & {
	defaultChecked?: boolean
} & {
	type?: typeof FieldTypes.enum.boolean
}

export type DateField = BasicField & {
	type?: typeof FieldTypes.enum.date
}

export type DocumentField = BasicField & {
	type?: typeof FieldTypes.enum.document
}

export type TextField = BasicField & {
	multiline?: boolean
} & {
	type?: typeof FieldTypes.enum.text
}

export type SlugField = BasicField & {
	type?: typeof FieldTypes.enum.slug
}

export type UrlField = BasicField & {
	type?: typeof FieldTypes.enum.url
}

type Field =
	| BooleanField
	| DateField
	| DocumentField
	| SlugField
	| TextField
	| UrlField

type SpecialSchemaKeys = 'content' | 'slug' | 'title'
export type SchemaKey = SpecialSchemaKeys | string
export type Schema<T extends SchemaKey> = Record<T, Field>

type CollectionSlug = z.infer<typeof COLLECTION_SLUG_REGEX>

export type Collection = {
	format?: CollectionFormat
	label: string
	path: ContentPath
	schema: Schema<SchemaKey>
	slug: CollectionSlug
}

export interface Collections {
	[key: string]: Collection
}

export type Config = {
	collections: Collections
}
