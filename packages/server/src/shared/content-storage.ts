import type z from 'zod'
import matter from 'gray-matter'
import type { Collection, Singleton, ContentFormat, SingletonFormat } from '@kobun/common'
import { ValidationError, safeFileOperation, logger } from '@kobun/common'

/**
 * Shared content storage abstractions
 */

export interface ContentStorage {
	exists(path: string): Promise<boolean>
	read(path: string): Promise<string | null>
	write(path: string, content: string): Promise<void>
	list(prefix: string): Promise<string[]>
	remove(path: string): Promise<void>
}

export interface CollectionOperations {
	readItems(filters?: Record<string, string>): Promise<Record<string, unknown>[]>
	readItem(params: { id?: string; slug?: string; schema: z.ZodType }): Promise<Record<string, unknown>>
	writeItem(params: { slug: string; content: string; oldSlug?: string }): Promise<void>
}

export interface SingletonOperations {
	read(schema: z.ZodType): Promise<Record<string, unknown>>
	write(content: string): Promise<void>
}

/**
 * Base content operations shared between Node.js and Cloudflare
 */
export abstract class BaseContentStorage {
	protected abstract storage: ContentStorage
	
	protected async parseFileContent(
		content: string, 
		schema: z.ZodType,
		filePath?: string
	): Promise<{ content: string; data: Record<string, unknown> }> {
		const { content: fileContent, data: metadata } = matter(content)
		
		const result = schema.safeParse(metadata)
		if (!result.success) {
			throw new ValidationError(
				'Failed to validate content metadata',
				{
					filePath,
					errors: result.error.errors
				}
			)
		}
		
		return { content: fileContent, data: result.data }
	}
	
	protected async filterItems(
		items: Record<string, unknown>[],
		filters?: Record<string, string>
	): Promise<Record<string, unknown>[]> {
		if (!filters) return items
		
		return items.filter((item) => {
			return Object.entries(filters).every(([key, value]) => {
				return item[key] === value
			})
		})
	}
	
	protected async findItemById(
		items: Record<string, unknown>[],
		id: string,
		schema: z.ZodType
	): Promise<Record<string, unknown> | null> {
		const item = items.find((item) => item.id === id)
		if (!item) return null
		
		const result = schema.safeParse(item)
		if (!result.success) {
			logger.warn('Item validation failed, returning partial data', {
				id,
				errors: result.error.errors
			})
			return item
		}
		
		return result.data
	}
}

/**
 * Collection operations implementation
 */
export class CollectionContentManager extends BaseContentStorage implements CollectionOperations {
	constructor(
		protected storage: ContentStorage,
		private collection: Collection,
		private format: ContentFormat,
		private getPath: (slug?: string) => string
	) {
		super()
	}
	
	async readItems(filters?: Record<string, string>): Promise<Record<string, unknown>[]> {
		const path = this.getPath()
		const files = await this.storage.list(path)
		
		const items = await Promise.all(
			files
				.filter(file => file.endsWith(`.${this.format}`))
				.map(async (filePath) => {
					const content = await this.storage.read(filePath)
					if (!content) return null
					
					const { data } = matter(content)
					return data
				})
		)
		
		const validItems = items.filter((item): item is Record<string, unknown> => item !== null)
		return this.filterItems(validItems, filters)
	}
	
	async readItem({ id, slug, schema }: { id?: string; slug?: string; schema: z.ZodType }): Promise<Record<string, unknown>> {
		let targetSlug = slug
		
		if (!targetSlug && id) {
			const items = await this.readItems()
			const item = await this.findItemById(items, id, schema)
			if (!item) return {}
			
			targetSlug = (item as any).slug
		}
		
		if (!targetSlug) return {}
		
		const path = this.getPath(targetSlug)
		const content = await this.storage.read(path)
		if (!content) return {}
		
		return this.parseFileContent(content, schema, path)
	}
	
	async writeItem({ slug, content, oldSlug }: { slug: string; content: string; oldSlug?: string }): Promise<void> {
		const path = this.getPath(slug)
		
		if (oldSlug) {
			const oldPath = this.getPath(oldSlug)
			// Note: This is a simplified approach - actual implementation would depend on storage type
			await this.storage.remove(oldPath)
		}
		
		await this.storage.write(path, content)
	}
}

/**
 * Singleton operations implementation
 */
export class SingletonContentManager extends BaseContentStorage implements SingletonOperations {
	constructor(
		protected storage: ContentStorage,
		private singleton: Singleton,
		private format: SingletonFormat,
		private getPath: () => string
	) {
		super()
	}
	
	async read(schema: z.ZodType): Promise<Record<string, unknown>> {
		const path = this.getPath()
		
		try {
			const content = await this.storage.read(path)
			if (!content) return {}
			
			const data = JSON.parse(content)
			const result = schema.safeParse(data)
			
			if (!result.success) {
				logger.warn('Singleton validation failed', {
					path,
					errors: result.error.errors
				})
				return {}
			}
			
			return result.data
		} catch (error) {
			logger.warn('Failed to read singleton', { path }, error as Error)
			return {}
		}
	}
	
	async write(content: string): Promise<void> {
		const path = this.getPath()
		await this.storage.write(path, content)
	}
}