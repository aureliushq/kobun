import { type ClassValue, clsx } from 'clsx'
import pluralize from 'pluralize-esm'
import { extendTailwindMerge } from 'tailwind-merge'
import invariant from 'tiny-invariant'
import type { Labels } from '~/components/rescribe'
import { BASE_PATH } from '~/lib/constants'
import type { Collections, Config } from '~/types'

export const cn = (...inputs: ClassValue[]) => {
	const twMerge = extendTailwindMerge({
		prefix: 'rs-',
	})
	return twMerge(clsx(inputs))
}

export const generateLabelsForCollection = (
	config: Config,
	collection: string,
): Labels => {
	return pluralize.isPlural(config?.collections[collection].label as string)
		? {
				plural: config?.collections[collection].label as string,
				singular: pluralize.singular(
					config?.collections[collection].label as string,
				) as string,
			}
		: {
				plural: pluralize(
					config?.collections[collection].label as string,
				) as string,
				singular: config?.collections[collection].label as string,
			}
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
		if (['settings', 'editor'].includes(parts[0])) {
			return { section: parts[0] }
		}
		return null
	}

	// Handle /collections/<collection> route (list view)
	if (parts.length === 2 && parts[0] === 'collections') {
		const collection = parts[1]
		invariant(
			collections[collection],
			`Collection "${collection}" not found`,
		)
		if (!collections[collection]) {
			return null
		}
		return { section: 'collections', collection, action: 'list' as const }
	}

	// Handle /editor/collections/<collection> route (new item)
	if (
		parts.length === 3 &&
		parts[0] === 'editor' &&
		parts[1] === 'collections'
	) {
		const collection = parts[2]
		invariant(
			collections[collection],
			`Collection "${collection}" not found`,
		)
		if (!collections[collection]) {
			return null
		}
		return { section: 'editor', collection, action: 'create' as const }
	}

	// Handle /editor/collections/<collection>/<slug> route (edit item)
	if (
		parts.length >= 4 &&
		parts[0] === 'editor' &&
		parts[1] === 'collections'
	) {
		const collection = parts[2]
		invariant(
			collections[collection],
			`Collection "${collection}" not found`,
		)
		if (!collections[collection]) {
			return null
		}
		const slug = parts.slice(3).join('/')
		return { section: 'editor', collection, action: 'edit' as const, slug }
	}

	return null
}

export const parseOutputPathname = ({ pathname }: { pathname: string }) => {
	const parts = pathname.split('/').map(decodeURIComponent)

	if (parts.length === 2) {
		const collection = parts[1]
		return { collection, root: true, slug: null }
	}

	if (parts.length === 3) {
		const collection = parts[1]
		const slug = parts[2]
		return { collection, root: false, slug }
	}

	if (parts.length > 3) {
		const collection = parts[1]
		const slug = parts.slice(2).join('/')
		return { collection, root: false, slug }
	}

	return null
}
