import { z } from 'zod'

type CollectionFormat = 'md' | 'mdx'

type Glob = '*' | '**'
type ContentPath = `${string}/${Glob}` | `${string}/${Glob}/${string}`

const FieldTypes = z.enum([
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

type BooleanField = BasicField & {
	defaultChecked?: boolean
} & {
	type?: typeof FieldTypes.enum.boolean
}

type DateField = BasicField & {
	type?: typeof FieldTypes.enum.date
}

type DocumentField = BasicField & {
	type?: typeof FieldTypes.enum.document
}

type TextField = BasicField & {
	multiline?: boolean
} & {
	type?: typeof FieldTypes.enum.text
}

type SlugField = BasicField & {
	type?: typeof FieldTypes.enum.slug
}

type UrlField = BasicField & {
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

const collectionSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
type CollectionSlug = z.infer<typeof collectionSlug>

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
