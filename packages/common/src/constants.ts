import { z } from 'zod'

export const BASE_PATH = '/'
export const APP_BASE_PATH = '/app'
export const PUBLIC_BASE_PATH = '/public'

export const COLLECTION_SLUG_REGEX = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
