import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
// Note: Removed FileStorage import as we use our own ContentStorage interface
import { logger, type AWSError } from '@kobun/common'

interface CloudflareR2Options {
	accountId: string
	bucketName: string
	accessKeyId: string
	secretAccessKey: string
	endpoint?: string
	publicUrlPrefix?: string
}

export class CloudflareR2FileStorage {
	private bucketName: string
	private endpoint: string
	private publicUrlPrefix?: string
	private client: S3Client

	constructor(options: CloudflareR2Options) {
		this.bucketName = options.bucketName

		// Set up the R2 endpoint
		this.endpoint =
			options.endpoint ||
			`https://${options.accountId}.r2.cloudflarestorage.com`

		this.publicUrlPrefix = options.publicUrlPrefix

		// Create S3 client for R2
		this.client = new S3Client({
			endpoint: this.endpoint,
			region: 'auto',
			credentials: {
				accessKeyId: options.accessKeyId,
				secretAccessKey: options.secretAccessKey,
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
			if ((error as AWSError).name === 'NotFound') {
				return false
			}
			logger.error(
				'Failed to check file existence',
				{
					key,
					bucket: this.bucketName,
				},
				error as Error,
			)
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
			logger.error(
				'Failed to upload file',
				{
					key,
					bucket: this.bucketName,
					fileType: file.type,
				},
				error as Error,
			)
			throw error
		}
	}

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
			if ((error as AWSError).name === 'NoSuchKey') {
				return null
			}
			logger.error(
				'Failed to get file',
				{
					key,
					bucket: this.bucketName,
				},
				error as Error,
			)
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
			logger.error(
				'Failed to delete file',
				{
					key,
					bucket: this.bucketName,
				},
				error as Error,
			)
			throw error
		}
	}

	getPublicUrl(key: string): string | null {
		if (!this.publicUrlPrefix) {
			return null
		}

		return `${this.publicUrlPrefix}/${encodeURIComponent(key)}`
	}

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
			logger.error(
				'Failed to list files',
				{
					prefix,
					bucket: this.bucketName,
				},
				error as Error,
			)
			return []
		}
	}
}
