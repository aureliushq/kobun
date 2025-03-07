import invariant from 'tiny-invariant'
import { z } from 'zod'
import { BASE_PATH, DEFAULT_FEATURES } from '~/constants'
import {
	type AdminPaths,
	type Collections,
	type ConfigSchema,
	type Features,
	type Field,
	FieldTypes,
	type SchemaKey,
} from '~/types'

export const createZodSchema = <T extends ConfigSchema<SchemaKey>>({
	features = DEFAULT_FEATURES,
	schema,
	options,
}: {
	features?: Features
	schema: T
	options?: {
		omit?: (keyof T)[]
		type?: 'action' | 'loader'
	}
}): z.ZodType => {
	const getFieldSchema = (field: Field): z.ZodType => {
		switch (field.type) {
			case FieldTypes.BOOLEAN:
				return z.coerce.boolean()
			case FieldTypes.DATE:
				return z.coerce.date()
			case FieldTypes.DOCUMENT:
			case FieldTypes.IMAGE:
			case FieldTypes.TEXT:
			case FieldTypes.SLUG:
			case FieldTypes.URL:
				return z.string()
			case FieldTypes.SELECT:
				return z.string()
			case FieldTypes.MULTISELECT:
				if (options?.type === 'action') {
					// this preprocessor is used to convert the string to an array of strings
					// but it doesn't work so I'm manually transforming the string to an array of strings
					// with the transformMultiselectFields function in @kobun/server
					return z.preprocess((val) => {
						if (typeof val === 'string') {
							return val.split(',').map((item) => item.trim())
						}
						return val
					}, z.array(z.string()))
				}

				return z.array(z.string()).transform((val) => val.join(','))
		}
	}

	// Create schema for user-defined fields
	const FIELD_SCHEMAS = Object.entries(schema).reduce<
		Record<string, z.ZodType>
	>((acc, [key, field]) => {
		if (options?.omit?.includes(key as keyof T)) {
			return acc
		}
		return {
			// biome-ignore lint/performance/noAccumulatingSpread: <explanation>
			...acc,
			[key]: getFieldSchema(field),
		}
	}, {})

	// Add built-in fields
	let BUILT_IN_SCHEMA = z.object({
		id: z.string(),
	})

	const allFeatures = { ...DEFAULT_FEATURES, ...features }
	if (allFeatures?.timestamps?.createdAt) {
		BUILT_IN_SCHEMA = BUILT_IN_SCHEMA.merge(
			z.object({ createdAt: z.coerce.date() }),
		)
	}
	if (allFeatures?.timestamps?.updatedAt) {
		BUILT_IN_SCHEMA = BUILT_IN_SCHEMA.merge(
			z.object({ updatedAt: z.coerce.date() }),
		)
	}

	const EXTENDED_SCHEMA = z.object(FIELD_SCHEMAS).merge(BUILT_IN_SCHEMA)

	if (allFeatures?.publish) {
		// Add publish status fields
		return z.discriminatedUnion('status', [
			EXTENDED_SCHEMA.merge(z.object({ status: z.literal('draft') })),
			EXTENDED_SCHEMA.merge(
				z.object({
					status: z.literal('published'),
					publishedAt: z.coerce.date(),
				}),
			),
		])
	}

	return EXTENDED_SCHEMA
}

export const parseAdminPathname = ({
	basePath = BASE_PATH,
	collections,
	pathname,
}: {
	basePath?: string | RegExp
	collections: Collections
	pathname: string
}): AdminPaths | null => {
	const replaced = pathname.replace(basePath, '')
	const parts =
		replaced === ''
			? []
			: replaced
					.split('/')
					.map(decodeURIComponent)
					.filter((item) => item !== '')

	if (parts.length === 0) return { section: 'root' }

	// Handle root-level routes
	if (parts.length === 1) {
		const slug = parts[0]
		// Explicitly type the array to handle the includes check
		const validSections = ['settings'] as const
		if (validSections.includes(slug as (typeof validSections)[number])) {
			return { section: slug as (typeof validSections)[number] }
		}
		return null
	}

	// Handle /collections/<collection> route (list view)
	if (parts.length === 2 && parts[0] === 'collections') {
		const collectionSlug = parts[1]
		invariant(
			collectionSlug,
			`Invalid value for collection: "${collectionSlug}"`,
		)
		if (!(collectionSlug in collections)) {
			return null
		}
		// TODO: parse url search params and return here
		return {
			section: 'collections',
			collectionSlug,
		}
	}

	// Handle /editor/collections/<collection> route (new item)
	if (
		parts.length === 3 &&
		parts[0] === 'editor' &&
		parts[1] === 'collections'
	) {
		const collectionSlug = parts[2]
		invariant(
			collectionSlug,
			`Invalid value for collection: "${collectionSlug}"`,
		)
		if (!(collectionSlug in collections)) {
			return null
		}
		// const slug = collections[collection]?.slug as string
		return {
			section: 'editor-create',
			collectionSlug,
			// slug,
		}
	}

	// Handle /editor/collections/<collection>/<slug> route (edit item)
	if (
		parts.length >= 4 &&
		parts[0] === 'editor' &&
		parts[1] === 'collections'
	) {
		const collectionSlug = parts[2]
		invariant(
			collectionSlug,
			`Invalid value for collection: "${collectionSlug}"`,
		)
		if (!(collectionSlug in collections)) {
			return null
		}
		const id = parts[3] as string
		return { section: 'editor-edit', collectionSlug, id }
	}

	return null
}
