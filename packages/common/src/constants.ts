// import { z } from 'zod'
import type { Features } from './types'

export const BASE_PATH = '/'
export const APP_BASE_PATH = '/app'
export const PUBLIC_BASE_PATH = '/public'

export const PATHS = {
	BASE: BASE_PATH,
	COLLECTIONS: 'collections',
	EDITOR: 'editor/collections',
	SETTINGS: 'settings',
}

// export const COLLECTION_SLUG_REGEX = z
// 	.string()
// 	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const DEFAULT_FEATURES: Features = {
	featured: { limit: 3 },
	publish: true,
	timestamps: { createdAt: true, updatedAt: true },
}
