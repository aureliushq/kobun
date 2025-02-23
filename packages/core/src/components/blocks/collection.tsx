import {
	type Collection as CollectionType,
	createZodSchema,
} from '@rescribe/common'
import {
	type Table as ReactTable,
	type RowData,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { CircleX, FileTextIcon, Settings2 } from 'lucide-react'
import { useContext, useId, useRef, useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import invariant from 'tiny-invariant'
import type z from 'zod'

import type { Labels } from '~/components/rescribe'
import { Button } from '~/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { EmptyState } from '~/components/ui/empty-state'
import { Input } from '~/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '~/components/ui/table'
import { PATHS } from '~/lib/constants'
import { createColumnDefs } from '~/lib/utils'
import { RescribeContext, type RescribeContextData } from '~/providers'

interface CollectionHeaderProps<TData> {
	basePath: string
	collection: CollectionType
	labels: Labels | undefined
	table: ReactTable<TData>
}

const CollectionHeader = <TData extends RowData>({
	basePath,
	collection,
	labels,
	table,
}: CollectionHeaderProps<TData>) => {
	const id = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const [inputValue, setInputValue] = useState('')

	const handleClearInput = () => {
		setInputValue('')
		if (inputRef.current) {
			inputRef.current.focus()
		}
	}

	return (
		<section className='rs-w-full rs-flex rs-flex-col rs-gap-2'>
			<div className='rs-w-full rs-h-12 rs-flex rs-items-center rs-justify-between'>
				<h3 className='rs-text-xl rs-font-semibold'>
					{collection.label}
				</h3>
				<div className='rs-flex rs-items-center rs-gap-2'>
					<Link to={`${basePath}/${PATHS.EDITOR}/${collection.slug}`}>
						<Button size='sm'>{`New ${labels?.singular}`}</Button>
					</Link>
				</div>
			</div>
			<div className='rs-w-full rs-h-12 rs-flex rs-items-center rs-justify-between'>
				<div className='rs-space-y-2 rs-min-w-[300px]'>
					<div className='rs-relative'>
						<Input
							className='rs-h-9 rs-pe-9'
							id={id}
							onChange={(event) =>
								table
									.getColumn('title')
									?.setFilterValue(event.target.value)
							}
							placeholder={`Search ${labels?.plural.toLowerCase()}...`}
							ref={inputRef}
							type='text'
							value={
								(table
									.getColumn('title')
									?.getFilterValue() as string) || ''
							}
						/>
						{inputValue && (
							<button
								aria-label='Clear input'
								className='rs-absolute rs-inset-y-0 rs-end-0 rs-flex rs-h-full rs-w-9 rs-items-center rs-justify-center rs-rounded-e-lg rs-text-muted-foreground/80 rs-outline-offset-2 rs-transition-colors hover:rs-text-foreground focus:rs-z-10 focus-visible:rs-outline focus-visible:rs-outline-2 focus-visible:rs-outline-ring/70 disabled:rs-pointer-events-none disabled:rs-cursor-not-allowed disabled:rs-opacity-50'
								onClick={handleClearInput}
								type='button'
							>
								<CircleX
									size={16}
									strokeWidth={2}
									aria-hidden='true'
								/>
							</button>
						)}
					</div>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='outline'
							size='sm'
							className='ml-auto hidden h-8 lg:flex'
						>
							<Settings2 />
							Display
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-[150px]'>
						<DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{table
							.getAllColumns()
							.filter(
								(column) =>
									typeof column.accessorFn !== 'undefined' &&
									column.getCanHide(),
							)
							.filter((column) => column.id !== 'actions')
							.map((column) => (
								<DropdownMenuCheckboxItem
									key={column.id}
									className='capitalize'
									checked={column.getIsVisible()}
									onCheckedChange={(value) =>
										column.toggleVisibility(!!value)
									}
								>
									{column.columnDef.header as string}
								</DropdownMenuCheckboxItem>
							))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</section>
	)
}

const Collection = ({
	labels,
}: {
	labels: Labels | undefined
}) => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	invariant(
		config,
		'`config` is required for the Rescribe component. Check the docs to see how to write the configuration.',
	)
	invariant(
		params?.collection,
		'Cannot read collection details. Check your URL.',
	)
	const basePath = config.basePath ?? ''
	const collection = config.collections[params.collection]

	const COLLECTION_ZOD_SCHEMA = createZodSchema({
		features: collection.features,
		options: {
			omit: ['content', 'slug', 'updatedAt'],
		},
		schema: collection.schema,
	})
	const columns = createColumnDefs({
		collectionSlug: collection.slug,
		options: {
			only: ['title', 'createdAt', 'updatedAt', 'status', 'publishedAt'],
		},
		schema: COLLECTION_ZOD_SCHEMA,
	}) as Array<z.infer<typeof COLLECTION_ZOD_SCHEMA>>

	const data = useLoaderData()

	const table = useReactTable({
		columns,
		data,
		initialState: {
			columnOrder: ['title', 'status', 'createdAt'],
			columnVisibility: {
				publishedAt: false,
				updatedAt: false,
			},
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	})

	return (
		<>
			<CollectionHeader
				basePath={basePath}
				collection={collection}
				labels={labels}
				table={table}
			/>
			{Array.isArray(data) && data.length > 0 ? (
				<div className='rs-rounded-lg rs-border rs-border-gray'>
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef
															.header,
														header.getContext(),
													)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						{table.getRowModel().rows?.length > 0 && (
							<TableBody>
								{table.getRowModel().rows.map((row) => (
									<TableRow className='rs-h-16' key={row.id}>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						)}
					</Table>
				</div>
			) : (
				<EmptyState
					className='rs-w-full rs-max-w-none rs-flex rs-flex-col rs-gap-2'
					title={`No ${labels?.plural.toLowerCase()} yet`}
					description={`It looks like there's nothing here yet! Get started by creating your first ${labels?.singular.toLowerCase()}.`}
					icons={[FileTextIcon, FileTextIcon, FileTextIcon]}
					action={
						<Link
							to={`${basePath}/${PATHS.EDITOR}/${collection.slug}`}
						>
							<Button
								className=''
								size='sm'
							>{`Write a new ${labels?.singular.toLowerCase()}`}</Button>
						</Link>
					}
				/>
			)}
		</>
	)
}

export default Collection
