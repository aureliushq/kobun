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
import {
	type CollectionDraft,
	DRAFT_MARKER_LABELS,
	type DraftMarker,
	draftMarker,
} from "@/core/editor/drafts"
import { resolveTitleKey } from "@/core/fields"
import { Timestamp } from "@/core/preferences/timestamp"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import { Input } from "@/ui/components/base/input"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
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

/**
 * The listing, in each of the three states the route can hand it over in. One
 * value rather than a list plus flags, so "loading, and also failed" cannot be
 * expressed — and all three arms of the route's `Suspense` read alike.
 */
export type CollectionListing = CollectionItem[] | "pending" | "unavailable"

/**
 * The Draft markers the filter offers. `COMMITTED` is left out because the
 * listing only asks for Dirty Drafts, and a filter offering a state no row can
 * be in is a control that answers nothing.
 */
const MARKER_OPTIONS: { label: string; value: DraftMarker }[] = (
	["NOT_IN_REPOSITORY", "UNCOMMITTED_CHANGES"] as DraftMarker[]
).map((value) => ({ label: DRAFT_MARKER_LABELS[value], value }))

/**
 * A row's two facts, kept apart. `publication` is read off the Source and only
 * off the Source; `marker` is the Draft standing beside it. Either can be
 * absent — a Draft with no Source has no Publication State to show, and an item
 * nobody is editing has no Draft — and neither ever stands in for the other
 * (ADR-0008, #127).
 */
type Row = {
	createdAt: number | undefined
	/** Where the row opens. A Draft brought its own; an item builds one. */
	href: string
	id: string
	marker: DraftMarker | null
	publication: Status | null
	title: string
}

const PUBLICATION_CLASSES: Record<Status, string> = {
	PUBLISHED:
		"bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400",
	DRAFT: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
	SCHEDULED:
		"bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
}

// One amber for every marker, and amber for nothing else: a Draft reads as work
// in hand rather than as one more Publication State, which is the whole point of
// its badge sitting beside that one instead of on top of it. A colour per marker
// would say the markers differ in kind, and they do not — only in news.
const MARKER_CLASS =
	"bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"

const ALL_STATUSES_VALUE = "all"
const ALL_STATUSES_LABEL = "All statuses"

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
 * A Collection's list: the Collection Items the repository holds, and the
 * Drafts the writer has not published to it yet.
 *
 * `listing` carries all three states the route can be in — one value rather
 * than a list plus flags — and the same component renders every arm of the
 * `Suspense` in `routes/collection`, which is what keeps the skeleton's
 * geometry matching the real table's by construction. `drafts` is awaited, so
 * it is real in all three: they come from the database, and losing them to
 * GitHub's silence would take away the half of the page that was still true.
 *
 * Every control the writer can reach while the listing is pending is either
 * disabled or needs nothing from it, so nothing is lost when React remounts the
 * tree around the resolved data.
 */
export function CollectionTable({
	collection,
	drafts,
	editorBase,
	listing,
}: {
	collection: Collection
	drafts: CollectionDraft[]
	editorBase: string
	listing: CollectionListing
}) {
	const pending = listing === "pending"
	const unavailable = listing === "unavailable"
	const items = Array.isArray(listing) ? listing : null

	const slugFieldKey = getSlugField(collection.schema)
	const titleFieldKey = resolveTitleKey(collection.schema)

	const rows = useMemo<Row[]>(() => {
		// At most one Draft tracks a given Source — the database says so, with a
		// unique index on the pair — so an item finds its Draft by path and takes
		// it out of the running for a row of its own.
		const bySourcePath = new Map(
			drafts.flatMap((draft) =>
				draft.sourcePath ? [[draft.sourcePath, draft] as const] : [],
			),
		)
		const itemRows = (items ?? []).map((item) => {
			const filenameSlug = item.name.replace(/\.mdx?$/, "")
			const title = titleFieldKey
				? String(item.data[titleFieldKey] ?? filenameSlug)
				: filenameSlug
			const slug = slugFieldKey
				? String(item.data[slugFieldKey] ?? filenameSlug)
				: filenameSlug
			const draft = bySourcePath.get(item.path)
			return {
				// The Draft's Data first, for the same reason its title wins: it is
				// the newer copy of the very fields this is read off. The Source's
				// stands behind it, for a Draft that names no date of its own.
				createdAt:
					(draft && deriveCreatedAt(collection.schema, draft.data)) ??
					deriveCreatedAt(collection.schema, item.data),
				href: draft?.href ?? `${editorBase}/item/${encodeURIComponent(slug)}`,
				id: item.path,
				marker: draft ? draftMarker(draft) : null,
				// Off the Source, always. A Draft says who holds the newer copy; it
				// has no standing to say what the site should do with the file that
				// is already in the repository (ADR-0008).
				publication: deriveStatus(collection.schema, item.data),
				// The Draft holds the newer title, and a row is best named after
				// what it opens rather than after the version already moved past.
				title: draft?.heading ?? title,
			}
		})

		// Every Draft with no Source behind it — and, until the listing arrives,
		// every Draft with one, since there is nothing yet for its item to absorb
		// it into.
		//
		// A Draft whose Source the arrived listing does not hold gets no row, and
		// that exception is deliberate: the file it tracks has gone from the
		// repository, so its editor has nothing to open and the row would lead to
		// a 404. It is still on the dashboard, which is where it can be discarded.
		const draftRows = drafts
			.filter((draft) => !draft.sourcePath || items === null)
			.map((draft) => ({
				// Its own Data is what it would be committed as, so the date is read
				// off it the same way; the row's own moment stands in when it names
				// none, which is what keeps a Draft inside the sort.
				createdAt:
					deriveCreatedAt(collection.schema, draft.data) ?? draft.createdAt,
				href: draft.href,
				id: `draft:${draft.id}`,
				marker: draftMarker(draft),
				// No Source, so no Publication State to read off one. Reading the
				// Draft's own `status` would put an item on the shelf the repository
				// has never heard of.
				publication: null,
				title: draft.heading,
			}))

		return [...itemRows, ...draftRows]
	}, [
		collection.schema,
		drafts,
		editorBase,
		items,
		titleFieldKey,
		slugFieldKey,
	])

	const publicationOptions = useMemo(
		() => statusOptions(collection.schema),
		[collection.schema],
	)
	// Grouped rather than pooled, so the filter says which of the two facts each
	// option asks about — "Draft" and "Not in repository" are answers to
	// different questions, and one flat list read as if they were the same one.
	const filterGroups = useMemo(
		() => [
			{ label: "Publication", options: publicationOptions },
			{ label: "Repository", options: MARKER_OPTIONS },
		],
		[publicationOptions],
	)
	// The trigger's wording is read off the very list the menu is built from,
	// so an option can never render in one and go unnamed in the other.
	const filterLabels = useMemo(
		() =>
			new Map<string, string>([
				[ALL_STATUSES_VALUE, ALL_STATUSES_LABEL],
				...filterGroups.flatMap((group) =>
					group.options.map(
						({ label, value }) => [value, label] as [string, string],
					),
				),
			]),
		[filterGroups],
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
							to={row.original.href}
							className="font-medium text-sm hover:underline"
						>
							{row.original.title}
						</Link>
						{/* An item with no created date has nothing to say about when
						    it was made, and an em dash says that better than a
						    formatter guessing at a missing number. */}
						{row.original.createdAt == null ? (
							<div className="text-muted-foreground text-xs">—</div>
						) : (
							<Timestamp
								className="text-muted-foreground text-xs"
								value={new Date(row.original.createdAt)}
							/>
						)}
					</div>
				),
				filterFn: (row, _columnId, filterValue) => {
					const v = String(filterValue ?? "").toLowerCase()
					if (!v) return true
					return row.original.title.toLowerCase().includes(v)
				},
			},
			{
				id: "status",
				// Sorted on whichever fact the row leads with, since a row with no
				// Source has only the marker to be ordered by.
				accessorFn: (row) => row.publication ?? row.marker ?? "",
				header: ({ column }) => (
					<SortableHeader column={column} disabled={pending} label="Status" />
				),
				cell: ({ row }) => (
					<div className="flex flex-wrap items-center gap-1.5">
						{row.original.publication && (
							<Badge
								variant="outline"
								className={`uppercase ${PUBLICATION_CLASSES[row.original.publication]}`}
							>
								{publicationOptions.find(
									({ value }) => value === row.original.publication,
								)?.label ?? row.original.publication}
							</Badge>
						)}
						{/* A Clean Draft holds nothing the Source lacks, so it has no
						    news and gets no badge. */}
						{row.original.marker && row.original.marker !== "COMMITTED" && (
							<Badge variant="outline" className={`uppercase ${MARKER_CLASS}`}>
								{DRAFT_MARKER_LABELS[row.original.marker]}
							</Badge>
						)}
					</div>
				),
				filterFn: (row, _columnId, filterValue) => {
					if (!filterValue || filterValue === "all") return true
					return (
						row.original.publication === filterValue ||
						row.original.marker === filterValue
					)
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
		[pending, publicationOptions],
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
		(table.getColumn("status")?.getFilterValue() as string | undefined) ??
		ALL_STATUSES_VALUE

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
								?.setFilterValue(v === ALL_STATUSES_VALUE ? undefined : v)
						}
					>
						<SelectTrigger aria-label="Filter by status" className="w-56">
							<SelectValue placeholder={ALL_STATUSES_LABEL}>
								{(value) =>
									filterLabels.get(value as string) ?? ALL_STATUSES_LABEL
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_STATUSES_VALUE}>
								{ALL_STATUSES_LABEL}
							</SelectItem>
							{filterGroups.map((group) => (
								<SelectGroup key={group.label}>
									<SelectLabel>{group.label}</SelectLabel>
									{group.options.map(({ label, value }) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectGroup>
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
						<SelectTrigger aria-label="Sort" className="w-56">
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
			{/* Inside the frame rather than in place of it: a writer whose
			    Collection kobun cannot read can still reach their Drafts and still
			    start a new item. */}
			{unavailable && <AsyncErrorAlert title="Couldn't load this collection" />}
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
						{table.getRowModel().rows.map((row) => (
							<TableRow key={row.id}>
								{row.getVisibleCells().map((cell) => (
									<TableCell className="h-16" key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))}
						{/* Under the Drafts rather than instead of them: the Drafts are
						    already here, and the skeleton stands only for the items still
						    on their way. */}
						{pending && <TableRowsSkeleton />}
						{/* Neither a pending listing nor a failed one may say the
						    Collection is empty — that is a wrong answer rather than a
						    placeholder, and the alert above already says what happened. */}
						{!pending &&
							!unavailable &&
							table.getRowModel().rows.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-32 text-center text-muted-foreground"
									>
										No items yet.
									</TableCell>
								</TableRow>
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
