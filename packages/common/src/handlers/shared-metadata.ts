import { customAlphabet } from 'nanoid'
import YAML from 'yaml'
import type {
	CollectionItemMetadata,
	SingletonMetadata,
	ContentPayload,
	MetadataGenerationOptions,
} from '../types/metadata.js'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 32)

// Re-export for backward compatibility
export type { MetadataGenerationOptions as MetadataOptions } from '../types/metadata.js'

/**
 * Generates standardized metadata for collection items
 */
export const generateItemMetadata = (
	payload: ContentPayload,
	options: MetadataGenerationOptions = {},
): CollectionItemMetadata => {
	const { intent, existingMetadata, generateId = true } = options
	const { content, ...metadataPayload } = payload

	let metadata: CollectionItemMetadata = {
		id: existingMetadata?.id || '',
		createdAt: existingMetadata?.createdAt || '',
		status: existingMetadata?.status || 'draft',
		...existingMetadata,
		...metadataPayload,
		updatedAt: new Date().toISOString(),
	}

	// Add ID for new items
	if (generateId && !existingMetadata) {
		metadata.id = nanoid()
		metadata.createdAt = new Date().toISOString()
		metadata.status = 'draft'
	}

	// Handle publish intent
	if (intent === 'publish') {
		metadata = {
			...metadata,
			publishedAt: new Date().toISOString(),
			status: 'published',
		}
	} else if (!existingMetadata) {
		metadata.status = 'draft'
	}

	return metadata
}

/**
 * Generates standardized metadata for singletons
 */
export const generateSingletonMetadata = (
	payload: ContentPayload,
): SingletonMetadata => {
	return {
		...payload,
		updatedAt: new Date().toISOString(),
	}
}

/**
 * Creates file content with YAML frontmatter
 */
export const createFileContent = (
	metadata: CollectionItemMetadata | SingletonMetadata,
	content = '',
): string => {
	const frontmatter = YAML.stringify(metadata).trimEnd()

	return content
		? `---\n${frontmatter}\n---\n\n${content}\n`
		: `---\n${frontmatter}\n---`
}

/**
 * Creates JSON content for singletons
 */
export const createSingletonContent = (metadata: SingletonMetadata): string => {
	return JSON.stringify(metadata, null, 2)
}
