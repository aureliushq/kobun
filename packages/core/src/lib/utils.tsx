import { type Config, PATHS } from '@kobun/common'
import type { ColumnDef } from '@tanstack/react-table'
import { type ClassValue, clsx } from 'clsx'
import { format } from 'date-fns'
import { PencilIcon } from 'lucide-react'
import pluralize from 'pluralize-esm'
import { Link } from 'react-router'
import { extendTailwindMerge } from 'tailwind-merge'
import z from 'zod'

import type { Labels } from '~/components/kobun'
import { Button } from '~/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '~/components/ui/tooltip'

export const cn = (...inputs: ClassValue[]) => {
	const twMerge = extendTailwindMerge({
		prefix: 'rs-',
	})
	return twMerge(clsx(inputs))
}

export const createColumnDefs = <T extends z.ZodType>({
	basePath,
	collectionSlug,
	options,
	schema,
}: {
	basePath: string
	collectionSlug: string
	options?: {
		omit?: string[]
		only?: string[]
		overrides?: Partial<Record<string, Partial<ColumnDef<z.infer<T>>>>>
	}
	schema: T
}): ColumnDef<z.infer<T>>[] => {
	// Helper function to get column definition based on Zod type
	const getColumnDef = (
		key: string,
		zodType: z.ZodType,
	): ColumnDef<z.infer<T>> => {
		const baseColumn: ColumnDef<z.infer<T>> = {
			accessorKey: key,
			header: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize first letter
		}

		// Handle different Zod types
		if (zodType instanceof z.ZodBoolean) {
			return {
				...baseColumn,
				cell: ({ getValue }) => (getValue() ? 'Yes' : 'No'),
			}
		}

		if (zodType instanceof z.ZodDate) {
			return {
				...baseColumn,
				cell: ({ getValue }) => {
					const date = getValue() as Date
					return date.toLocaleDateString()
				},
			}
		}

		if (zodType instanceof z.ZodArray) {
			return {
				...baseColumn,
				cell: ({ getValue }) => {
					const value = getValue()
					if (Array.isArray(value)) {
						// If array contains objects with 'label', use that
						if (value[0]?.label) {
							return value.map((v) => v.label).join(', ')
						}
						// Otherwise join the values
						return value.join(', ')
					}
					return ''
				},
			}
		}

		if (zodType instanceof z.ZodObject) {
			return {
				...baseColumn,
				cell: ({ getValue }) => {
					const value = getValue()
					// If object has 'label', use that
					// @ts-ignore
					if (value?.label) return value.label
					// Otherwise stringify the object
					return JSON.stringify(value)
				},
			}
		}

		// Default for strings and other types
		return baseColumn
	}

	// For discriminated unions, we need to extract the common fields
	if (schema instanceof z.ZodDiscriminatedUnion) {
		// Get the first option's shape (they should all share common fields)
		const firstOption = schema.options[0]
		
		// Type guard to check if the option is a ZodObject
		if (!firstOption || typeof firstOption !== 'object' || !('shape' in firstOption)) {
			throw new Error('Invalid discriminated union schema structure')
		}
		
		const shape = (firstOption as { shape: Record<string, z.ZodType> }).shape

		// Function to check if a field should be included
		const shouldIncludeField = (key: string) => {
			if (options?.only) {
				return options.only.includes(key)
			}
			return !options?.omit?.includes(key)
		}

		// Generate columns from common fields
		const columns = Object.entries(shape)
			.filter(([key]) => shouldIncludeField(key))
			.map(([key, zodType]) => {
				// Special handling for built-in fields
				switch (key) {
					case 'status': {
						return {
							accessorKey: key,
							header: 'Status',
							cell: ({ getValue }) => {
								const status = getValue() as
									| 'draft'
									| 'published'
								return (
									status.charAt(0).toUpperCase() +
									status.slice(1)
								)
							},
						} as ColumnDef<z.infer<T>>
					}

					case 'createdAt': {
						return {
							accessorKey: key,
							header: 'Created',
							cell: ({ getValue }) => {
								const date = getValue() as Date
								return format(new Date(date), 'PP')
							},
							sortingFn: 'datetime',
						} as ColumnDef<z.infer<T>>
					}

					case 'updatedAt': {
						return {
							accessorKey: key,
							header: 'Updated',
							cell: ({ getValue }) => {
								const date = getValue() as Date
								return format(new Date(date), 'PP')
							},
							sortingFn: 'datetime',
						} as ColumnDef<z.infer<T>>
					}

					default: {
						// @ts-ignore
						const defaultDef = getColumnDef(key, zodType)
						const override = options?.overrides?.[key]
						return {
							...defaultDef,
							...override,
						}
					}
				}
			})

		// Add publishedAt column if not omitted
		if (shouldIncludeField('publishedAt')) {
			columns.push({
				accessorKey: 'publishedAt',
				header: 'Published',
				cell: ({ getValue }) => {
					const date = getValue() as Date | undefined
					return date ? format(new Date(date), 'PP') : '-'
				},
				sortingFn: 'datetime',
			} as ColumnDef<z.infer<T>>)
		}

		columns.push({
			accessorKey: 'actions',
			cell: ({ row }) => (
				<div className='rs-flex rs-justify-end rs-gap-2'>
					<Link
						prefetch='intent'
						to={`${basePath}/${PATHS.EDITOR}/${collectionSlug}/${row.original.id}`}
					>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									className='rs-w-9 rs-h-9'
									size='icon'
									variant='ghost'
								>
									<PencilIcon className='rs-w-4 rs-h-4' />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Edit</TooltipContent>
						</Tooltip>
					</Link>
				</div>
			),
			header: '',
		})

		// @ts-ignore
		return columns
	}

	throw new Error('Schema must be a Zod discriminated union')
}

export const generateLabelsForCollection = (
	config: Config,
	collection: string,
): Labels => {
	return pluralize.isPlural(config?.collections[collection].label as string)
		? {
				plural: config?.collections[collection].label as string,
				singular: pluralize.singular(
					config?.collections[collection].label as string,
				) as string,
			}
		: {
				plural: pluralize(
					config?.collections[collection].label as string,
				) as string,
				singular: config?.collections[collection].label as string,
			}
}

export const parseOutputPathname = ({ pathname }: { pathname: string }) => {
	const parts = pathname.split('/').map(decodeURIComponent)

	if (parts.length === 2) {
		const collection = parts[1]
		return { collection, root: true, slug: null }
	}

	if (parts.length === 3) {
		const collection = parts[1]
		const slug = parts[2]
		return { collection, root: false, slug }
	}

	if (parts.length > 3) {
		const collection = parts[1]
		const slug = parts.slice(2).join('/')
		return { collection, root: false, slug }
	}

	return null
}
