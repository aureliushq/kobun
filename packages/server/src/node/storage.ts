import { promises as fs } from 'node:fs'
import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'
import type { ContentStorage } from '../shared/content-storage.js'
import { logger } from '@kobun/common'

/**
 * Node.js file system implementation of ContentStorage
 */
export class NodeFileStorage implements ContentStorage {
	async exists(path: string): Promise<boolean> {
		try {
			await fs.access(path)
			return true
		} catch {
			return false
		}
	}
	
	async read(path: string): Promise<string | null> {
		try {
			return await readFile(path, 'utf-8')
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return null
			}
			throw error
		}
	}
	
	async write(path: string, content: string): Promise<void> {
		// Ensure directory exists
		const dir = path.split('/').slice(0, -1).join('/')
		if (!(await this.exists(dir))) {
			await fs.mkdir(dir, { recursive: true })
		}
		
		await fs.writeFile(path, content)
	}
	
	async list(prefix: string): Promise<string[]> {
		try {
			return await fg(prefix, { onlyFiles: true })
		} catch (error) {
			logger.error('Failed to list files', { prefix }, error as Error)
			return []
		}
	}
	
	async remove(path: string): Promise<void> {
		await fs.unlink(path)
	}
}