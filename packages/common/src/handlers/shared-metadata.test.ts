import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateItemMetadata, generateSingletonMetadata, createFileContent, createSingletonContent } from './shared-metadata'

describe('shared-metadata', () => {
	beforeEach(() => {
		// Mock Date.now to get consistent timestamps
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
	})

	describe('generateItemMetadata', () => {
		it('should generate metadata for new items with ID', () => {
			const payload = {
				title: 'Test Item',
				content: 'Test content'
			}

			const metadata = generateItemMetadata(payload)

			expect(metadata).toMatchObject({
				title: 'Test Item',
				updatedAt: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z',
				status: 'draft'
			})
			expect(metadata.id).toBeDefined()
			expect(metadata.id).toHaveLength(32)
		})

		it('should not generate ID when generateId is false', () => {
			const payload = { title: 'Test' }
			const metadata = generateItemMetadata(payload, { generateId: false })

			expect(metadata.id).toBe('')
			expect(metadata.createdAt).toBe('')
		})

		it('should preserve existing metadata', () => {
			const payload = { title: 'Updated Title' }
			const existingMetadata = {
				id: 'existing-id',
				createdAt: '2023-01-01T00:00:00Z',
				status: 'published' as const,
				author: 'John Doe'
			}

			const metadata = generateItemMetadata(payload, { existingMetadata })

			expect(metadata).toMatchObject({
				id: 'existing-id',
				createdAt: '2023-01-01T00:00:00Z',
				status: 'published',
				author: 'John Doe',
				title: 'Updated Title',
				updatedAt: '2024-01-01T00:00:00.000Z'
			})
		})

		it('should handle publish intent', () => {
			const payload = { title: 'Test' }
			const metadata = generateItemMetadata(payload, { intent: 'publish' })

			expect(metadata.status).toBe('published')
			expect(metadata.publishedAt).toBe('2024-01-01T00:00:00.000Z')
		})

		it('should exclude content from metadata', () => {
			const payload = {
				title: 'Test',
				content: 'This should not appear in metadata'
			}

			const metadata = generateItemMetadata(payload)

			expect(metadata.content).toBeUndefined()
			expect(metadata.title).toBe('Test')
		})
	})

	describe('generateSingletonMetadata', () => {
		it('should generate singleton metadata', () => {
			const payload = {
				setting1: 'value1',
				setting2: 'value2'
			}

			const metadata = generateSingletonMetadata(payload)

			expect(metadata).toEqual({
				setting1: 'value1',
				setting2: 'value2',
				updatedAt: '2024-01-01T00:00:00.000Z'
			})
		})
	})

	describe('createFileContent', () => {
		it('should create file content with frontmatter and content', () => {
			const metadata = {
				title: 'Test Title',
				status: 'draft' as const
			}
			const content = 'This is the content'

			const result = createFileContent(metadata, content)

			expect(result).toBe(
				'---\ntitle: Test Title\nstatus: draft\n---\n\nThis is the content\n'
			)
		})

		it('should create file content with only frontmatter when no content', () => {
			const metadata = {
				title: 'Test Title',
				status: 'draft' as const
			}

			const result = createFileContent(metadata)

			expect(result).toBe(
				'---\ntitle: Test Title\nstatus: draft\n---'
			)
		})
	})

	describe('createSingletonContent', () => {
		it('should create JSON content for singletons', () => {
			const metadata = {
				setting1: 'value1',
				setting2: 42,
				setting3: true
			}

			const result = createSingletonContent(metadata)

			expect(result).toBe(JSON.stringify(metadata, null, 2))
			expect(JSON.parse(result)).toEqual(metadata)
		})
	})
})