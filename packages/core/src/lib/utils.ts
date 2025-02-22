import type { Config } from '@rescribe/common'
import { type ClassValue, clsx } from 'clsx'
import pluralize from 'pluralize-esm'
import { extendTailwindMerge } from 'tailwind-merge'

import type { Labels } from '~/components/rescribe'

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
