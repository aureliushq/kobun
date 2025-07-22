import { describe, it, expect } from 'vitest'
import { transformMultiselectFields } from './shared-processing'
import { FieldTypes } from '../types'

describe('shared-processing', () => {
	describe('transformMultiselectFields', () => {
		it('should transform string multiselect fields to arrays', () => {
			const payload = {
				tags: 'javascript,typescript,react',
				title: 'Test Article',
				published: true
			}

			const schema = {
				tags: { type: FieldTypes.MULTISELECT },
				title: { type: FieldTypes.TEXT },
				published: { type: FieldTypes.BOOLEAN }
			}

			const result = transformMultiselectFields(payload, schema)

			expect(result).toEqual({
				tags: ['javascript', 'typescript', 'react'],
				title: 'Test Article',
				published: true
			})
		})

		it('should handle empty multiselect fields', () => {
			const payload = {
				tags: '',
				title: 'Test Article'
			}

			const schema = {
				tags: { type: FieldTypes.MULTISELECT },
				title: { type: FieldTypes.TEXT }
			}

			const result = transformMultiselectFields(payload, schema)

			expect(result).toEqual({
				tags: '',
				title: 'Test Article'
			})
		})

		it('should trim whitespace from multiselect values', () => {
			const payload = {
				tags: ' javascript , typescript , react '
			}

			const schema = {
				tags: { type: FieldTypes.MULTISELECT }
			}

			const result = transformMultiselectFields(payload, schema)

			expect(result.tags).toEqual(['javascript', 'typescript', 'react'])
		})

		it('should not transform non-multiselect fields', () => {
			const payload = {
				title: 'javascript,typescript,react',
				tags: 'web,frontend'
			}

			const schema = {
				title: { type: FieldTypes.TEXT },
				tags: { type: FieldTypes.MULTISELECT }
			}

			const result = transformMultiselectFields(payload, schema)

			expect(result).toEqual({
				title: 'javascript,typescript,react',
				tags: ['web', 'frontend']
			})
		})

		it('should handle missing schema fields gracefully', () => {
			const payload = {
				tags: 'one,two,three',
				unknownField: 'value'
			}

			const schema = {
				tags: { type: FieldTypes.MULTISELECT }
			}

			const result = transformMultiselectFields(payload, schema)

			expect(result).toEqual({
				tags: ['one', 'two', 'three'],
				unknownField: 'value'
			})
		})

		it('should handle already transformed arrays', () => {
			const payload = {
				tags: ['javascript', 'typescript']
			}

			const schema = {
				tags: { type: FieldTypes.MULTISELECT }
			}

			const result = transformMultiselectFields(payload, schema)

			expect(result.tags).toEqual(['javascript', 'typescript'])
		})
	})
})