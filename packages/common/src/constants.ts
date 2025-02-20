import { z } from 'zod'

export const COLLECTION_SLUG_REGEX = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
