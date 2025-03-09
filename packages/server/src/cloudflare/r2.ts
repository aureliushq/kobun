import type { FileStorage } from '@mjackson/file-storage'

/**
 * Configuration options for Cloudflare R2 storage
 */
interface CloudflareR2Options {
	/**
	 * The Cloudflare account ID
	 */
	accountId: string

	/**
	 * The R2 bucket name
	 */
	bucketName: string

	/**
	 * The access key ID for R2
	 */
	accessKeyId: string

	/**
	 * The secret access key for R2
	 */
	secretAccessKey: string

	/**
	 * Optional custom endpoint URL (for using Workers or custom domain)
	 */
	endpoint?: string

	/**
	 * Optional public URL prefix for files (for generating public URLs)
	 */
	publicUrlPrefix?: string
}

/**
 * A FileStorage implementation for Cloudflare R2
 */
export class CloudflareR2FileStorage implements FileStorage {
	private bucketName: string
	private endpoint: string
	private publicUrlPrefix?: string
	private headers: Headers

	/**
	 * Create a new CloudflareR2FileStorage instance
	 */
	constructor(private options: CloudflareR2Options) {
		this.bucketName = options.bucketName

		// Set up the R2 endpoint
		this.endpoint =
			options.endpoint ||
			`https://${options.accountId}.r2.cloudflarestorage.com`

		this.publicUrlPrefix = options.publicUrlPrefix

		// Create authorization headers for R2 API requests
		this.headers = new Headers({
			'X-Amz-Access-Key-Id': options.accessKeyId,
			'X-Amz-Secret-Access-Key': options.secretAccessKey,
		})
	}

	/**
	 * Checks if a file exists in the R2 bucket
	 */
	async has(key: string): Promise<boolean> {
		try {
			const url = `${this.endpoint}/${this.bucketName}/${encodeURIComponent(key)}`
			const response = await fetch(url, {
				method: 'HEAD',
				headers: this.headers,
			})

			return response.ok
		} catch (error) {
			console.error(`Error checking if file exists: ${error}`)
			return false
		}
	}

	/**
	 * Uploads a file to the R2 bucket
	 */
	async set(key: string, file: File): Promise<void> {
		try {
			const url = `${this.endpoint}/${this.bucketName}/${encodeURIComponent(key)}`

			// Clone the headers and add content type
			const uploadHeaders = new Headers(this.headers)
			uploadHeaders.append(
				'Content-Type',
				file.type || 'application/octet-stream',
			)

			const response = await fetch(url, {
				method: 'PUT',
				headers: uploadHeaders,
				body: file,
			})

			if (!response.ok) {
				throw new Error(`Failed to upload file: ${response.statusText}`)
			}
		} catch (error) {
			console.error(`Error uploading file: ${error}`)
			throw error
		}
	}

	/**
	 * Retrieves a file from the R2 bucket
	 */
	async get(key: string): Promise<File | null> {
		try {
			const url = `${this.endpoint}/${this.bucketName}/${encodeURIComponent(key)}`
			const response = await fetch(url, {
				method: 'GET',
				headers: this.headers,
			})

			if (!response.ok) {
				if (response.status === 404) {
					return null
				}
				throw new Error(`Failed to get file: ${response.statusText}`)
			}

			const blob = await response.blob()
			const contentType =
				response.headers.get('Content-Type') ||
				'application/octet-stream'
			const filename = key.split('/').pop() || key

			return new File([blob], filename, { type: contentType })
		} catch (error) {
			console.error(`Error getting file: ${error}`)
			return null
		}
	}

	/**
	 * Deletes a file from the R2 bucket
	 */
	async remove(key: string): Promise<void> {
		try {
			const url = `${this.endpoint}/${this.bucketName}/${encodeURIComponent(key)}`
			const response = await fetch(url, {
				method: 'DELETE',
				headers: this.headers,
			})

			if (!response.ok) {
				throw new Error(`Failed to delete file: ${response.statusText}`)
			}
		} catch (error) {
			console.error(`Error deleting file: ${error}`)
			throw error
		}
	}

	/**
	 * Generates a public URL for a file (if publicUrlPrefix is configured)
	 */
	getPublicUrl(key: string): string | null {
		if (!this.publicUrlPrefix) {
			return null
		}

		return `${this.publicUrlPrefix}/${encodeURIComponent(key)}`
	}

	/**
	 * Lists files in the bucket with an optional prefix
	 */
	// @ts-ignore
	async list(prefix?: string): Promise<string[]> {
		try {
			let url = `${this.endpoint}/${this.bucketName}?list-type=2`

			if (prefix) {
				url += `&prefix=${encodeURIComponent(prefix)}`
			}

			const response = await fetch(url, {
				method: 'GET',
				headers: this.headers,
			})

			if (!response.ok) {
				throw new Error(`Failed to list files: ${response.statusText}`)
			}

			const xml = await response.text()
			const parser = new DOMParser()
			const xmlDoc = parser.parseFromString(xml, 'text/xml')

			const keys: string[] = []
			const contents = xmlDoc.getElementsByTagName('Contents')

			for (let i = 0; i < contents.length; i++) {
				const keyElement = contents[i]?.getElementsByTagName('Key')[0]
				if (keyElement?.textContent) {
					keys.push(keyElement.textContent)
				}
			}

			return keys
		} catch (error) {
			console.error(`Error listing files: ${error}`)
			return []
		}
	}
}

/**
 * Example usage:
 *
 * const storage = new CloudflareR2FileStorage({
 *   accountId: 'your-account-id',
 *   bucketName: 'your-bucket-name',
 *   accessKeyId: 'your-access-key-id',
 *   secretAccessKey: 'your-secret-access-key',
 *   publicUrlPrefix: 'https://your-public-bucket.example.com'
 * });
 *
 * // Upload a file
 * const file = new File(['file content'], 'filename.txt', { type: 'text/plain' });
 * await storage.set('uploads/filename.txt', file);
 *
 * // Check if file exists
 * const exists = await storage.has('uploads/filename.txt');
 *
 * // Get a file
 * const retrievedFile = await storage.get('uploads/filename.txt');
 *
 * // Delete a file
 * await storage.remove('uploads/filename.txt');
 *
 * // Get a public URL
 * const url = storage.getPublicUrl('uploads/filename.txt');
 *
 * // List files with prefix
 * const files = await storage.list('uploads/');
 */
