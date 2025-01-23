import { z } from 'zod'

const BASE_PATH = '/rescribe'
export const BASE_PATH_REGEX = /^\/rescribe\/?/
export const PATHS = {
	BASE: BASE_PATH,
	COLLECTIONS: `${BASE_PATH}/collections`,
}

// TODO: move to server package
export const REMIX_APP_BASE_PATH = '/app'
export const REMIX_APP_PUBLIC_PATH = '/public'

export const COLLECTION_SLUG_REGEX = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
