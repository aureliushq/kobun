import { describe, it, expect, vi } from 'vitest'
import { withErrorHandling, validateSubmission, safeExecute } from './handlers'
import { KobunError, ValidationError, NotFoundError } from './types'

// Mock logger
vi.mock('../utils/logger', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}))

describe('error handlers', () => {
	describe('withErrorHandling', () => {
		it('should execute function normally when no error occurs', () => {
			const mockFn = vi.fn().mockReturnValue('success')
			const wrappedFn = withErrorHandling(mockFn, 'test-context')

			const result = wrappedFn('arg1', 'arg2')

			expect(result).toBe('success')
			expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
		})

		it('should handle async functions', async () => {
			const mockFn = vi.fn().mockResolvedValue('async-success')
			const wrappedFn = withErrorHandling(mockFn, 'test-context')

			const result = await wrappedFn('arg1')

			expect(result).toBe('async-success')
			expect(mockFn).toHaveBeenCalledWith('arg1')
		})

		it('should handle sync errors', () => {
			const error = new Error('Sync error')
			const mockFn = vi.fn().mockImplementation(() => {
				throw error
			})
			const wrappedFn = withErrorHandling(mockFn, 'test-context')

			expect(() => wrappedFn()).toThrow('Sync error')
		})

		it('should handle async errors', async () => {
			const error = new Error('Async error')
			const mockFn = vi.fn().mockRejectedValue(error)
			const wrappedFn = withErrorHandling(mockFn, 'test-context')

			await expect(wrappedFn()).rejects.toThrow('Async error')
		})
	})

	describe('validateSubmission', () => {
		it('should return submission when status is success', () => {
			const submission = {
				status: 'success' as const,
				payload: { field: 'value' },
			}

			const result = validateSubmission(submission, 'test-operation')

			expect(result).toBe(submission)
		})

		it('should throw ValidationError when status is not success', () => {
			const submission = {
				status: 'error' as const,
				error: { field: ['Required'] },
			}

			expect(() =>
				validateSubmission(submission, 'test-operation'),
			).toThrow(ValidationError)
		})

		it('should include submission details in error', () => {
			const submission = {
				status: 'error' as const,
				error: { field: ['Required'] },
				reply: { formData: 'test' },
			}

			try {
				validateSubmission(submission, 'test-operation')
			} catch (error) {
				expect(error).toBeInstanceOf(ValidationError)
				expect((error as ValidationError).details).toMatchObject({
					submission: { field: ['Required'] },
					status: 'error',
				})
			}
		})
	})

	describe('safeExecute', () => {
		it('should return operation result when successful', async () => {
			const operation = vi.fn().mockResolvedValue({ data: 'success' })

			const result = await safeExecute(operation, 'test-context')

			expect(result).toEqual({ data: 'success' })
		})

		it('should return error response for KobunError', async () => {
			const kobunError = new KobunError('Test error', 'TEST_ERROR', 400)
			const operation = vi.fn().mockRejectedValue(kobunError)

			const result = await safeExecute(operation, 'test-context')

			expect(result).toMatchObject({
				error: {
					message: 'Test error',
					code: 'TEST_ERROR',
					statusCode: 400,
				},
				timestamp: expect.any(String),
			})
		})

		it('should convert unknown errors to KobunError', async () => {
			const unknownError = new Error('Unknown error')
			const operation = vi.fn().mockRejectedValue(unknownError)

			const result = await safeExecute(operation, 'test-context')

			expect(result).toMatchObject({
				error: {
					message: 'Unknown error',
					code: 'UNKNOWN_ERROR',
					statusCode: 500,
				},
				timestamp: expect.any(String),
			})
		})

		it('should handle errors without message', async () => {
			const errorWithoutMessage = { someProperty: 'value' }
			const operation = vi.fn().mockRejectedValue(errorWithoutMessage)

			const result = await safeExecute(operation, 'test-context')

			expect(result).toMatchObject({
				error: {
					message: 'An unknown error occurred',
					code: 'UNKNOWN_ERROR',
					statusCode: 500,
				},
				timestamp: expect.any(String),
			})
		})
	})
})
