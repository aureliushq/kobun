import type { ContentStorage } from '../shared/content-storage.js'
import type { CloudflareR2FileStorage } from './r2.js'

/**
 * Cloudflare R2 implementation of ContentStorage
 */
export class CloudflareContentStorage implements ContentStorage {
	constructor(private r2Storage: CloudflareR2FileStorage) {}

	async exists(path: string): Promise<boolean> {
		return this.r2Storage.has(path)
	}

	async read(path: string): Promise<string | null> {
		return this.r2Storage.get(path)
	}

	async write(path: string, content: string): Promise<void> {
		const blob = new Blob([content], { type: 'text/plain' })
		const file = new File([blob], path.split('/').pop() || 'file')
		await this.r2Storage.set(path, file)
	}

	async list(prefix: string): Promise<string[]> {
		return this.r2Storage.list(prefix)
	}

	async remove(path: string): Promise<void> {
		await this.r2Storage.remove(path)
	}
}
