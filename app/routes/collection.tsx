import {
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
import { eq } from "drizzle-orm"
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	ChevronsUpDown,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Link, redirect, useParams } from "react-router"
import invariant from "tiny-invariant"
import { getAuth } from "@/auth/auth.server"
import { fetchAndParseConfig } from "@/config/github.server"
import { envContext } from "@/core/context"
import { isMarkdownCollectionFile } from "@/core/editor/collection-items.server"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema/app-schema"
import { listGithubDirectoryFiles } from "@/github/octokit.server"
import { parseFrontmatter } from "@/lib/frontmatter"
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/ui/components/base/table"
import { H2 } from "@/ui/components/base/typegraphy"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/collection"

type CollectionItem = {
	name: string
	path: string
	sha: string
	data: Record<string, unknown>
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const { owner, name, collection_slug } = params
	invariant(collection_slug, "collection_slug is required")

	const projects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
		with: { githubInstallation: true },
	})
	const activeProject = projects.find(
		(p) => p.repoOwnerLogin === owner && p.repoName === name,
	)
	if (!activeProject) throw redirect(PATHS.SETUP)

	const installationId = activeProject.githubInstallation.githubInstallationId

	const configResult = await fetchAndParseConfig(
		env,
		installationId,
		owner,
		name,
	)

	const config = configResult.config
	invariant(config, "config is required")

	const collection = config.collections[collection_slug]
	invariant(collection, "collection is required")

	const dirPath = `${config.basePath}/${collection_slug}`.replace(/\/+/g, "/")

	let items: CollectionItem[] = []
	try {
		const files = await listGithubDirectoryFiles(
			env,
			installationId,
			owner,
			name,
			dirPath,
		)

		items = files.filter(isMarkdownCollectionFile).map((f) => {
			const parsed = parseFrontmatter(f.content)
			return {
				name: f.name,
				path: f.path,
				sha: f.sha,
				data: parsed.data as Record<string, unknown>,
			}
		})
	} catch (error) {
		// Empty / missing directory → just show no items.
		if (
			!(error instanceof Error && "status" in error && error.status === 404)
		) {
			throw error
		}
	}

	return { collection, collectionSlug: collection_slug, items }
}

type Status = "DRAFT" | "PUBLISHED" | "SCHEDULED"

type Row = {
	id: string
	title: string
	slug: string
	status: Status
	createdAt: number | null
	createdAtRaw: unknown
}

function deriveStatus(data: Record<string, unknown>): Status {
	const raw = data.status
	if (typeof raw === "string") {
		const upper = raw.toUpperCase()
		if (upper === "DRAFT" || upper === "PUBLISHED" || upper === "SCHEDULED") {
			return upper
		}
	}
	if (data.draft === true) return "DRAFT"
	if (data.published === false) return "DRAFT"
	return "PUBLISHED"
}

function deriveCreatedAt(data: Record<string, unknown>): {
	timestamp: number | null
	raw: unknown
} {
	const candidate = data.createdAt ?? data.date ?? data.publishedAt
	if (candidate == null) return { timestamp: null, raw: null }
	const d = new Date(candidate as string | number | Date)
	if (Number.isNaN(d.getTime())) return { timestamp: null, raw: candidate }
	return { timestamp: d.getTime(), raw: candidate }
}

function formatRelative(ts: number | null): string {
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

const STATUS_FILTER_LABELS: Record<string, string> = {
	all: "All statuses",
	PUBLISHED: "Published",
	DRAFT: "Draft",
	SCHEDULED: "Scheduled",
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

export default function Collection({ loaderData }: Route.ComponentProps) {
	const { collection, items, collectionSlug } = loaderData
	const params = useParams()
	const owner = params.owner ?? ""
	const name = params.name ?? ""
	const editorBase = `/${owner}/${name}/collections/${collectionSlug}/editor`

	const schemaEntries = Object.entries(collection.schema)
	const slugEntry = schemaEntries.find(([, f]) => f.type === "slug")
	const slugFieldKey = slugEntry?.[0]
	const titleFieldKey =
		slugEntry && slugEntry[1].type === "slug" ? slugEntry[1].from : undefined

	const rows = useMemo<Row[]>(
		() =>
			items.map((item) => {
				const filenameSlug = item.name.replace(/\.mdx?$/, "")
				const title = titleFieldKey
					? String(item.data[titleFieldKey] ?? filenameSlug)
					: filenameSlug
				const slug = slugFieldKey
					? String(item.data[slugFieldKey] ?? filenameSlug)
					: filenameSlug
				const created = deriveCreatedAt(item.data)
				return {
					id: item.path,
					title,
					slug,
					status: deriveStatus(item.data),
					createdAt: created.timestamp,
					createdAtRaw: created.raw,
				}
			}),
		[items, titleFieldKey, slugFieldKey],
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
					<SortableHeader column={column} label="Title" />
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
					<SortableHeader column={column} label="Status" />
				),
				cell: ({ row }) => (
					<Badge
						variant="outline"
						className={`uppercase ${STATUS_CLASSES[row.original.status]}`}
					>
						{row.original.status}
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
				sortingFn: (a, b) => {
					const av = a.original.createdAt ?? -Infinity
					const bv = b.original.createdAt ?? -Infinity
					return av - bv
				},
			},
		],
		[editorBase],
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
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between gap-4">
				<H2>{collection.label}</H2>

				<div className="flex items-center gap-2">
					<Input
						placeholder="Search by title…"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value)
							table.getColumn("title")?.setFilterValue(e.target.value)
						}}
						className="max-w-xs"
					/>
					<Select
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
									STATUS_FILTER_LABELS[value as string] ?? "All statuses"
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
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
					<Button render={<Link to={`${editorBase}/new`} />}>
						New {singularize(collection.label)}
					</Button>
				</div>
			</div>

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
						{table.getRowModel().rows.length === 0 ? (
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
				<div className="text-muted-foreground text-xs">
					{totalRows === 0
						? "0 items"
						: `Showing ${pageStart}–${pageEnd} of ${totalRows}`}
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
					<span className="px-2 text-xs">
						Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
					</span>
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
		</div>
	)
}

function SortableHeader<TData>({
	column,
	label,
}: {
	column: import("@tanstack/react-table").Column<TData, unknown>
	label: string
}) {
	const sorted = column.getIsSorted()
	return (
		<Button
			variant="ghost"
			size="sm"
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
