import { customAlphabet } from 'nanoid'
import YAML from 'yaml'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 32)

export interface MetadataOptions {
	intent?: string
	existingMetadata?: Record<string, any>
	generateId?: boolean
}

/**
 * Generates standardized metadata for collection items
 */
export const generateItemMetadata = (
	payload: Record<string, any>,
	options: MetadataOptions = {}
): Record<string, any> => {
	const { intent, existingMetadata, generateId = true } = options
	const { content, ...metadataPayload } = payload

	let metadata: Record<string, any> = {
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
	payload: Record<string, any>
): Record<string, any> => {
	return {
		...payload,
		updatedAt: new Date().toISOString(),
	}
}

/**
 * Creates file content with YAML frontmatter
 */
export const createFileContent = (
	metadata: Record<string, any>,
	content = ''
): string => {
	const frontmatter = YAML.stringify(metadata).trimEnd()
	
	return content
		? `---\n${frontmatter}\n---\n\n${content}\n`
		: `---\n${frontmatter}\n---`
}

/**
 * Creates JSON content for singletons
 */
export const createSingletonContent = (metadata: Record<string, any>): string => {
	return JSON.stringify(metadata, null, 2)
}