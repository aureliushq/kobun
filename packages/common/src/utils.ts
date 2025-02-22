import invariant from 'tiny-invariant'
import { BASE_PATH } from '~/constants'
import type { Collections } from '~/types'

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
