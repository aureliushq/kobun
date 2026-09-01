import {
	type Column,
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	ChevronsUpDown,
} from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { Link } from "react-router"
import type { Collection } from "@/config/types"
import {
	deriveCreatedAt,
	deriveStatus,
	type Status,
	statusOptions,
} from "@/core/editor/collection-list"
import { getSlugField } from "@/core/editor/collection-metadata"
import { resolveTitleKey } from "@/core/fields"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import { Input } from "@/ui/components/base/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/ui/components/base/select"
import { Skeleton } from "@/ui/components/base/skeleton"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/ui/components/base/table"
import { H2 } from "@/ui/components/base/typegraphy"
import { AsyncErrorAlert } from "@/ui/components/blocks/async-error-alert"
import { TableRowsSkeleton } from "@/ui/components/blocks/skeletons"

/** One Collection Item in the listing, as the route's loader hands it over. */
export type CollectionItem = {
	name: string
	path: string
	sha: string
	data: Record<string, unknown>
}

type Row = {
	id: string
	title: string
	slug: string
	status: Status
	createdAt: number | undefined
}

function formatRelative(ts: number | undefined): string {
	if (ts == null) return "—"
	return formatDistanceToNow(new Date(ts), { addSuffix: true })
}

const STATUS_CLASSES: Record<Status, string> = {
	PUBLISHED:
		"bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400",
	DRAFT: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
	SCHEDULED:
		"bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
}

const SORT_LABELS: Record<string, string> = {
	"createdAt:desc": "Sort by: Newest",
	"createdAt:asc": "Sort by: Oldest",
	"title:asc": "Sort by: Title (A→Z)",
	"title:desc": "Sort by: Title (Z→A)",
}

function singularize(s: string): string {
	return s.endsWith("s") ? s.slice(0, -1) : s
}

/**
 * The one control on this page that needs nothing from the listing, so the one
 * that is never disabled and never absent — not while the rows stream in, and
 * not when they fail to.
 */
function NewItemButton({
	collection,
	editorBase,
}: {
	collection: Collection
	editorBase: string
}) {
	return (
		<Link to={`${editorBase}/new`}>
			<Button>New {singularize(collection.label)}</Button>
		</Link>
	)
}

/**
 * Everything on a Collection's page that comes from the Config: the label, and
 * whatever actions sit beside it. The route awaits all of it, so this is what
 * paints on the first navigation — and it is shared rather than copied so that
 * the frame a failed listing keeps is the same frame, not a lookalike.
 */
function CollectionFrame({
	actions,
	children,
	collection,
}: {
	actions: ReactNode
	children: ReactNode
	collection: Collection
}) {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between gap-4">
				<H2>{collection.label}</H2>
				{actions}
			</div>
			{children}
		</div>
	)
}

/**
 * Where the page goes when the listing never arrives. It keeps the frame rather
 * than letting `AsyncErrorAlert` stand alone: the frame is the whole point of
 * the split, and a writer whose Collection kobun cannot read can still start a
 * new item.
 */
export function CollectionUnavailable({
	collection,
	editorBase,
}: {
	collection: Collection
	editorBase: string
}) {
	return (
		<CollectionFrame
			actions={
				<NewItemButton collection={collection} editorBase={editorBase} />
			}
			collection={collection}
		>
			<AsyncErrorAlert title="Couldn't load this collection" />
		</CollectionFrame>
	)
}

/**
 * A Collection's list of Collection Items.
 *
 * `items` is `null` while the listing is still streaming — one state rather
 * than a list plus a flag, so "loading, with rows" cannot be expressed. The
 * same component renders both halves of the `Suspense` in `routes/collection`,
 * which is what keeps the skeleton's geometry matching the real table's by
 * construction. Everything the writer can reach while `items` is null is either
 * disabled or needs nothing from the listing, so nothing is lost when React
 * remounts the tree around the resolved data.
 */
export function CollectionTable({
	collection,
	editorBase,
	items,
}: {
	collection: Collection
	editorBase: string
	items: CollectionItem[] | null
}) {
	const pending = items === null

	const slugFieldKey = getSlugField(collection.schema)
	const titleFieldKey = resolveTitleKey(collection.schema)

	const rows = useMemo<Row[]>(
		() =>
			(items ?? []).map((item) => {
				const filenameSlug = item.name.replace(/\.mdx?$/, "")
				const title = titleFieldKey
					? String(item.data[titleFieldKey] ?? filenameSlug)
					: filenameSlug
				const slug = slugFieldKey
					? String(item.data[slugFieldKey] ?? filenameSlug)
					: filenameSlug
				return {
					id: item.path,
					title,
					slug,
					status: deriveStatus(collection.schema, item.data),
					createdAt: deriveCreatedAt(collection.schema, item.data),
				}
			}),
		[collection.schema, items, titleFieldKey, slugFieldKey],
	)

	const statuses = useMemo(
		() => statusOptions(collection.schema),
		[collection.schema],
	)
	const statusFilters = useMemo(
		() => [{ label: "All statuses", value: "all" }, ...statuses],
		[statuses],
	)

	const [sorting, setSorting] = useState<SortingState>([
		{ id: "createdAt", desc: true },
	])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [search, setSearch] = useState("")
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: 50,
	})

	const columns = useMemo<ColumnDef<Row>[]>(
		() => [
			{
				accessorKey: "title",
				header: ({ column }) => (
					<SortableHeader column={column} disabled={pending} label="Title" />
				),
				cell: ({ row }) => (
					<div className="flex flex-col gap-0.5 p-0">
						<Link
							to={`${editorBase}/item/${encodeURIComponent(row.original.slug)}`}
							className="font-medium text-sm hover:underline"
						>
							{row.original.title}
						</Link>
						<div className="text-muted-foreground text-xs">
							{formatRelative(row.original.createdAt)}
						</div>
					</div>
				),
				filterFn: (row, _columnId, filterValue) => {
					const v = String(filterValue ?? "").toLowerCase()
					if (!v) return true
					return row.original.title.toLowerCase().includes(v)
				},
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<SortableHeader column={column} disabled={pending} label="Status" />
				),
				cell: ({ row }) => (
					<Badge
						variant="outline"
						className={`uppercase ${STATUS_CLASSES[row.original.status]}`}
					>
						{statuses.find(({ value }) => value === row.original.status)
							?.label ?? row.original.status}
					</Badge>
				),
				filterFn: (row, _columnId, filterValue) => {
					if (!filterValue || filterValue === "all") return true
					return row.original.status === filterValue
				},
			},
			{
				accessorKey: "createdAt",
				// Hidden header — sorting is exposed via the toolbar.
				header: () => null,
				cell: () => null,
				enableSorting: true,
				sortingFn: "basic",
				// An item with no created date has nothing to sort on, so it goes last
				// under Newest and under Oldest alike.
				sortUndefined: "last",
			},
		],
		[editorBase, pending, statuses],
	)

	const table = useReactTable({
		data: rows,
		columns,
		state: { sorting, columnFilters, pagination },
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	})

	const statusFilterValue =
		(table.getColumn("status")?.getFilterValue() as string | undefined) ?? "all"

	const pageIndex = table.getState().pagination.pageIndex
	const pageSize = table.getState().pagination.pageSize
	const totalRows = table.getFilteredRowModel().rows.length
	const pageStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1
	const pageEnd = Math.min((pageIndex + 1) * pageSize, totalRows)

	return (
		<CollectionFrame
			actions={
				<div className="flex items-center gap-2">
					{/* Disabled rather than absent while the listing streams: a control
					    that looks ready and answers to nothing is worse than one that
					    says it is not ready yet. */}
					<Input
						placeholder="Search by title…"
						disabled={pending}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value)
							table.getColumn("title")?.setFilterValue(e.target.value)
						}}
						className="max-w-xs"
					/>
					<Select
						disabled={pending}
						value={statusFilterValue}
						onValueChange={(v) =>
							table
								.getColumn("status")
								?.setFilterValue(v === "all" ? undefined : v)
						}
					>
						<SelectTrigger className="w-56">
							<SelectValue placeholder="All statuses">
								{(value) =>
									statusFilters.find((option) => option.value === value)
										?.label ?? "All statuses"
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{statusFilters.map(({ label, value }) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						disabled={pending}
						value={
							sorting[0]
								? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
								: "createdAt:desc"
						}
						onValueChange={(v) => {
							if (!v) return
							const [id, dir] = v.split(":")
							setSorting([{ id, desc: dir === "desc" }])
						}}
					>
						<SelectTrigger className="w-56">
							<SelectValue placeholder="Sort by">
								{(value) => SORT_LABELS[value as string] ?? "Sort by"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{Object.entries(SORT_LABELS).map(([value, label]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<NewItemButton collection={collection} editorBase={editorBase} />
				</div>
			}
			collection={collection}
		>
			<div className="overflow-hidden">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="text-muted-foreground text-xs uppercase tracking-wider"
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{pending ? (
							<TableRowsSkeleton />
						) : table.getRowModel().rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-32 text-center text-muted-foreground"
								>
									No items yet.
								</TableCell>
							</TableRow>
						) : (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell className="h-16" key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between gap-4">
				{/* Both counts stand in behind a bar rather than reading 0 and 1: a
				    tally of rows nobody has counted yet is a wrong answer, not a
				    placeholder. */}
				<div className="text-muted-foreground text-xs">
					{pending ? (
						<Skeleton className="h-4 w-32" />
					) : totalRows === 0 ? (
						"0 items"
					) : (
						`Showing ${pageStart}–${pageEnd} of ${totalRows}`
					)}
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => table.firstPage()}
						disabled={!table.getCanPreviousPage()}
						aria-label="First page"
					>
						<ChevronsLeft className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
						aria-label="Previous page"
					>
						<ChevronLeft className="size-4" />
					</Button>
					{pending ? (
						<Skeleton className="mx-2 h-4 w-20" />
					) : (
						<span className="px-2 text-xs">
							{`Page ${pageIndex + 1} of ${Math.max(table.getPageCount(), 1)}`}
						</span>
					)}
					<Button
						variant="ghost"
						size="icon"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
						aria-label="Next page"
					>
						<ChevronRight className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => table.lastPage()}
						disabled={!table.getCanNextPage()}
						aria-label="Last page"
					>
						<ChevronsRight className="size-4" />
					</Button>
				</div>
			</div>
		</CollectionFrame>
	)
}

function SortableHeader<TData>({
	column,
	disabled,
	label,
}: {
	column: Column<TData, unknown>
	disabled: boolean
	label: string
}) {
	const sorted = column.getIsSorted()
	return (
		<Button
			variant="ghost"
			size="sm"
			disabled={disabled}
			className="-ml-2 h-7 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hover:bg-transparent"
			onClick={() => column.toggleSorting(sorted === "asc")}
		>
			{label}
			{sorted === "asc" ? (
				<ArrowUp className="ml-1 size-3" />
			) : sorted === "desc" ? (
				<ArrowDown className="ml-1 size-3" />
			) : (
				<ChevronsUpDown className="ml-1 size-3 opacity-50" />
			)}
		</Button>
	)
}
