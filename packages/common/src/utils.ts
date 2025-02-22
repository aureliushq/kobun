import invariant from 'tiny-invariant'
import { z } from 'zod'
import { BASE_PATH } from '~/constants'
import {
	type Collections,
	type ConfigSchema,
	type Field,
	FieldTypes,
	type SchemaKey,
} from '~/types'

export const createZodSchema = <T extends ConfigSchema<SchemaKey>>(
	schema: T,
) => {
	const getFieldSchema = (field: Field): z.ZodType => {
		switch (field.type) {
			case FieldTypes.BOOLEAN:
				return z.boolean()
			case FieldTypes.DATE:
				return z.date()
			case FieldTypes.DOCUMENT:
			case FieldTypes.IMAGE:
			case FieldTypes.TEXT:
			case FieldTypes.SLUG:
			case FieldTypes.URL:
				return z.string()
			case FieldTypes.SELECT:
				return z.object({ label: z.string(), value: z.string() })
			case FieldTypes.MULTISELECT:
				return z.array(
					z.object({ label: z.string(), value: z.string() }),
				)
		}
	}

	// Create schema for user-defined fields
	const FIELD_SCHEMAS = Object.entries(schema).reduce<
		Record<string, z.ZodType>
	>(
		(acc, [key, field]) => ({
			// biome-ignore lint/performance/noAccumulatingSpread: <explanation>
			...acc,
			[key]: getFieldSchema(field),
		}),
		{},
	)

	// Add built-in fields
	const BUILT_IN_SCHEMA = z.object({
		createdAt: z.date(),
		updatedAt: z.date(),
	})

	const EXTENDED_SCHEMA = z.object(FIELD_SCHEMAS).merge(BUILT_IN_SCHEMA)

	// Add publish status fields
	return z.discriminatedUnion('status', [
		EXTENDED_SCHEMA.extend({ status: z.literal('draft') }),
		EXTENDED_SCHEMA.extend({
			status: z.literal('published'),
			publishedAt: z.date(),
		}),
	])
}

export const parseAdminPathname = ({
	basePath = BASE_PATH,
	collections,
	pathname,
}: {
	basePath?: string | RegExp
	collections: Collections
	pathname: string
}) => {
	const replaced = pathname.replace(basePath, '')
	const parts =
		replaced === ''
			? []
			: replaced
					.split('/')
					.map(decodeURIComponent)
					.filter((item) => item !== '')

	if (parts.length === 0) return { root: true }

	// Handle root-level routes
	if (parts.length === 1) {
		const slug = parts[0]
		// Explicitly type the array to handle the includes check
		const validSections = ['settings', 'editor'] as const
		if (validSections.includes(slug as (typeof validSections)[number])) {
			return { section: slug }
		}
		return null
	}

	// Handle /collections/<collection> route (list view)
	if (parts.length === 2 && parts[0] === 'collections') {
		const collection = parts[1]
		invariant(collection, `Invalid value for collection: "${collection}"`)
		if (!(collection in collections)) {
			return null
		}
		const slug = collections[collection]?.slug
		// TODO: parse url search params and return here
		return {
			action: 'list' as const,
			collection,
			section: 'collections',
			slug,
		}
	}

	// Handle /editor/collections/<collection> route (new item)
	if (
		parts.length === 3 &&
		parts[0] === 'editor' &&
		parts[1] === 'collections'
	) {
		const collection = parts[2]
		invariant(collection, `Invalid value for collection: "${collection}"`)
		if (!(collection in collections)) {
			return null
		}
		const slug = collections[collection]?.slug
		return {
			action: 'create' as const,
			collection,
			section: 'editor',
			slug,
		}
	}

	// Handle /editor/collections/<collection>/<slug> route (edit item)
	if (
		parts.length >= 4 &&
		parts[0] === 'editor' &&
		parts[1] === 'collections'
	) {
		const collection = parts[2]
		invariant(collection, `Invalid value for collection: "${collection}"`)
		if (!(collection in collections)) {
			return null
		}
		const slug = parts.slice(3).join('/')
		return { section: 'editor', collection, action: 'edit' as const, slug }
	}

	return null
}
