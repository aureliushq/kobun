import { z } from 'zod'

export const BASE_PATH = '/rescribe'
export const BASE_PATH_REGEX = /^\/rescribe\/?/

export const REMIX_BASE_PATH = '/app'

export const COLLECTION_SLUG_REGEX = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
