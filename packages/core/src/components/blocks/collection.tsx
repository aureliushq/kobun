import {
	type Collection as CollectionType,
	createZodSchema,
} from '@rescribe/common'
import {
	type ColumnFiltersState,
	type Table as ReactTable,
	type RowData,
	type SortingState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
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
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
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
	collectionSlug: string
	labels: Labels | undefined
	table: ReactTable<TData>
}

const CollectionHeader = <TData extends RowData>({
	basePath,
	collection,
	collectionSlug,
	labels,
	table,
}: CollectionHeaderProps<TData>) => {
	const id = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const [inputValue, setInputValue] = useState('')
	const [orderValue, setOrderValue] = useState('newest-first')

	const handleClearInput = () => {
		setInputValue('')
		table.getColumn('title')?.setFilterValue('')
		if (inputRef.current) {
			inputRef.current.focus()
		}
	}

	const handleOrdering = (value: string) => {
		setOrderValue(value)
		switch (value) {
			case 'newest-first': {
				const column = table.getColumn('createdAt')
				column?.toggleSorting(true)
				break
			}
			case 'oldest-first': {
				const column = table.getColumn('createdAt')
				column?.toggleSorting(false)
				break
			}
			// case 'recently-published': {
			// 	const createdAtColumn = table.getColumn('createdAt')
			// 	const publishedAtColumn = table.getColumn('publishedAt')
			// 	const updatedAtColumn = table.getColumn('updatedAt')
			// 	createdAtColumn?.clearSorting()
			// 	publishedAtColumn?.toggleSorting(true)
			// 	publishedAtColumn?.setFilterValue({
			// 		id: 'publishedAt',
			// 		value: (value: Date | null) => {
			// 			console.log(value)
			// 			return value !== null && value !== undefined
			// 		},
			// 	})
			// 	updatedAtColumn?.clearSorting()
			// 	break
			// }
			case 'recently-updated': {
				const createdAtColumn = table.getColumn('createdAt')
				const updatedAtColumn = table.getColumn('updatedAt')
				createdAtColumn?.clearSorting()
				updatedAtColumn?.toggleSorting(true)
			}
		}
	}

	return (
		<section className='rs-w-full rs-flex rs-flex-col rs-gap-2'>
			<div className='rs-w-full rs-h-12 rs-flex rs-items-center rs-justify-between'>
				<h3 className='rs-text-xl rs-font-semibold'>
					{collection.label}
				</h3>
				<div className='rs-flex rs-items-center rs-gap-2'>
					<div className='rs-relative'>
						<Input
							className='rs-h-9 rs-pe-9'
							id={id}
							onChange={(event) => {
								table
									.getColumn('title')
									?.setFilterValue(event.target.value)
								setInputValue(event.target.value)
							}}
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
						<DropdownMenuContent
							align='end'
							className='rs-w-[320px]'
						>
							<DropdownMenuLabel>Ordering</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuRadioGroup
								onValueChange={handleOrdering}
								value={orderValue}
							>
								<DropdownMenuRadioItem value='newest-first'>
									Newest first
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value='oldest-first'>
									Oldest first
								</DropdownMenuRadioItem>
								{/* TODO: check if publish feature is enabled */}
								{/* <DropdownMenuRadioItem value='recently-published'> */}
								{/* 	Recently published */}
								{/* </DropdownMenuRadioItem> */}
								<DropdownMenuRadioItem value='recently-updated'>
									Recently updated
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
							<DropdownMenuSeparator />
							<DropdownMenuLabel>
								Column visibility
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{table
								.getAllColumns()
								.filter(
									(column) =>
										typeof column.accessorFn !==
											'undefined' && column.getCanHide(),
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
					<Link to={`${basePath}/${PATHS.EDITOR}/${collectionSlug}`}>
						<Button size='sm'>{`New ${labels?.singular}`}</Button>
					</Link>
				</div>
			</div>
		</section>
	)
}

const Collection = ({
	collectionSlug,
	labels,
}: {
	collectionSlug: string
	labels: Labels | undefined
}) => {
	const { config } = useContext<RescribeContextData>(RescribeContext)
	invariant(
		config,
		'`config` is required for the Rescribe component. Check the docs to see how to write the configuration.',
	)
	const basePath = config.basePath ?? ''
	const collection = config.collections[collectionSlug]

	const COLLECTION_ZOD_SCHEMA = createZodSchema({
		features: collection.features,
		options: {
			omit: ['content', 'slug', 'updatedAt'],
		},
		schema: collection.schema,
	})
	const columns = createColumnDefs({
		basePath,
		collectionSlug,
		options: {
			only: ['title', 'createdAt', 'updatedAt', 'status', 'publishedAt'],
		},
		schema: COLLECTION_ZOD_SCHEMA,
	}) as Array<z.infer<typeof COLLECTION_ZOD_SCHEMA>>

	const data = useLoaderData()

	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [sorting, setSorting] = useState<SortingState>([
		{
			id: 'createdAt',
			desc: true,
		},
	])

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
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		onSortingChange: setSorting,
		state: {
			columnFilters,
			sorting,
		},
	})

	return (
		<>
			<CollectionHeader
				basePath={basePath}
				collection={collection}
				collectionSlug={collectionSlug}
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
							to={`${basePath}/${PATHS.EDITOR}/${collectionSlug}`}
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
