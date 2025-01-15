import { z } from 'zod'

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
export type FieldType = z.infer<typeof FieldTypes>

export type BasicField = {
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

export type Field =
	| BooleanField
	| DateField
	| DocumentField
	| SlugField
	| TextField
	| UrlField

type SpecialSchemaKeys = 'content' | 'slug' | 'title'
type SchemaKey = SpecialSchemaKeys | string
type Schema<T extends SchemaKey> = Record<T, Field>

export const collectionSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export type CollectionSlug = z.infer<typeof collectionSlug>

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
