import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import type { FileStorage } from '@mjackson/file-storage'

// interface CloudflareR2Options {
// 	accountId: string
// 	bucketName: string
// 	accessKeyId: string
// 	secretAccessKey: string
// 	endpoint?: string
// 	publicUrlPrefix?: string
// }

interface Env {
	ACCOUNT_ID: string
	ACCESS_KEY: string
	BUCKET_NAME: string
	SECRET_ACCESS_KEY: string
}

export class CloudflareR2FileStorage implements FileStorage {
	private bucketName: string
	private endpoint: string
	private publicUrlPrefix?: string
	private client: S3Client

	// constructor(options: CloudflareR2Options) {
	// 	this.bucketName = options.bucketName
	//
	// 	// Set up the R2 endpoint
	// 	this.endpoint =
	// 		options.endpoint ||
	// 		`https://${options.accountId}.r2.cloudflarestorage.com`
	//
	// 	this.publicUrlPrefix = options.publicUrlPrefix
	//
	// 	// Create S3 client for R2
	// 	this.client = new S3Client({
	// 		endpoint: this.endpoint,
	// 		region: 'auto',
	// 		credentials: {
	// 			accessKeyId: options.accessKeyId,
	// 			secretAccessKey: options.secretAccessKey,
	// 		},
	// 		requestChecksumCalculation: 'WHEN_REQUIRED',
	// 		responseChecksumValidation: 'WHEN_REQUIRED',
	// 	})
	// }

	constructor(env: Env) {
		this.bucketName = env.BUCKET_NAME as string

		// Set up the R2 endpoint
		this.endpoint = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`

		this.publicUrlPrefix = ''

		// Create S3 client for R2
		this.client = new S3Client({
			endpoint: this.endpoint,
			region: 'auto',
			credentials: {
				accessKeyId: env.ACCESS_KEY,
				secretAccessKey: env.SECRET_ACCESS_KEY,
			},
			requestChecksumCalculation: 'WHEN_REQUIRED',
			responseChecksumValidation: 'WHEN_REQUIRED',
		})
	}

	async has(key: string): Promise<boolean> {
		try {
			const command = new HeadObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			await this.client.send(command)
			return true
		} catch (error) {
			// biome-ignore lint: lint/suspicious/noExplicitAny
			if ((error as any).name === 'NotFound') {
				return false
			}
			console.error(`Error checking if file exists: ${error}`)
			return false
		}
	}

	async set(key: string, file: File): Promise<void> {
		try {
			const arrayBuffer = await file.arrayBuffer()

			const command = new PutObjectCommand({
				Bucket: this.bucketName,
				Key: key,
				Body: Buffer.from(arrayBuffer),
				ContentType: file.type || 'application/octet-stream',
			})

			await this.client.send(command)
		} catch (error) {
			console.error(`Error uploading file: ${error}`)
			throw error
		}
	}

	// @ts-ignore
	async get(key: string): Promise<string | null> {
		try {
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			const response = await this.client.send(command)

			if (!response.Body) {
				return null
			}

			return response.Body.transformToString()
		} catch (error) {
			// biome-ignore lint: lint/suspicious/noExplicitAny
			if ((error as any).name === 'NoSuchKey') {
				return null
			}
			console.error(`Error getting file: ${error}`)
			return null
		}
	}

	async remove(key: string): Promise<void> {
		try {
			const command = new DeleteObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			await this.client.send(command)
		} catch (error) {
			console.error(`Error deleting file: ${error}`)
			throw error
		}
	}

	getPublicUrl(key: string): string | null {
		if (!this.publicUrlPrefix) {
			return null
		}

		return `${this.publicUrlPrefix}/${encodeURIComponent(key)}`
	}

	// @ts-ignore
	async list(prefix?: string): Promise<string[]> {
		try {
			const command = new ListObjectsV2Command({
				Bucket: this.bucketName,
				Prefix: prefix,
			})

			const response = await this.client.send(command)

			if (!response.Contents) {
				return []
			}

			return response.Contents.map((item) => item.Key).filter(
				(key): key is string => key !== undefined,
			)
		} catch (error) {
			console.error(`Error listing files: ${error}`)
			return []
		}
	}
}
