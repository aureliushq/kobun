import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import { Skeleton } from "@/ui/components/base/skeleton"
import { TableCell, TableRow } from "@/ui/components/base/table"

/**
 * The shapes a page reserves while its slow half streams in (ADR 0006).
 *
 * Each is built out of the same container components the real content uses, so
 * its geometry matches by construction rather than by a measured height someone
 * has to keep in step. Bars are sized to the line-height of the text they stand
 * in for, and every width is fixed: a width that differs between the server
 * render and the client one is a hydration mismatch, which is why the widths
 * below cycle a constant list by index and never come from `Math.random`.
 */

/** Widths that read as text of varying length without varying between renders. */
const TITLE_WIDTHS = ["w-48", "w-64", "w-40"]

export function CardListSkeleton({ count = 3 }: { count?: number }) {
	return (
		<div className="flex flex-col gap-3">
			{Array.from({ length: count }, (_, index) => (
				<Card key={index} size="sm">
					<CardHeader>
						<CardTitle>
							<Skeleton
								className={`h-4 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`}
							/>
						</CardTitle>
						<CardDescription>
							<Skeleton className="h-3.5 w-56 max-w-full" />
						</CardDescription>
						<CardAction>
							<Skeleton className="h-5 w-24" />
						</CardAction>
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-4">
						<Skeleton className="h-3.5 w-32" />
						<div className="flex items-center gap-2">
							<Skeleton className="h-8 w-24" />
							<Skeleton className="h-8 w-20" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	)
}

/**
 * The rows a Collection's table reserves while its listing streams in.
 *
 * The geometry answers to the `columns` `CollectionTable` declares in
 * `app/core/editor/collection-table.tsx`: `h-16` cells, a title bar over the
 * smaller line that carries the created date, and a bar the size of the status
 * Badge. The third cell is empty on purpose — the `createdAt` column renders
 * `null` for both its header and its cells, but the `<th>` and `<td>` still
 * exist, and a skeleton row with fewer cells than the header would size the
 * columns differently until the real rows arrived.
 */
export function TableRowsSkeleton({ count = 5 }: { count?: number }) {
	return (
		<>
			{Array.from({ length: count }, (_, index) => (
				<TableRow key={index}>
					<TableCell className="h-16">
						<div className="flex flex-col gap-0.5">
							<Skeleton
								className={`h-4 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`}
							/>
							<Skeleton className="h-3.5 w-24" />
						</div>
					</TableCell>
					<TableCell className="h-16">
						{/* The Badge's box, not its text */}
						<Skeleton className="h-5 w-20" />
					</TableCell>
					<TableCell className="h-16" />
				</TableRow>
			))}
		</>
	)
}

/** Line lengths that read as prose without varying between renders. */
const PARAGRAPH_LINES = [
	["w-full", "w-full", "w-11/12", "w-2/3"],
	["w-full", "w-10/12", "w-1/2"],
	["w-full", "w-full", "w-3/4"],
]

/**
 * The writing column a Collection Item reserves while its Effective Content
 * streams in.
 *
 * The geometry answers to `packages/editor/styles/editor.css` and to
 * `RichTextEditor` itself. `pl-12` is the drag handle's gutter, which belongs to
 * the writing column rather than to whether the editor accepts input — without
 * it the prose would land 3rem left of where this stood. `min-h-[640px]` and
 * `max-w-[42rem]` are `.ProseMirror`'s own box, and the min-height is the
 * load-bearing one: the real editor is that tall before it holds a word, so a
 * shorter placeholder would let the page collapse and rebound. Bars are `h-4` on
 * a `gap-2.5` rhythm — 16px + 10px is the 26px line box of `font-size: 1rem` at
 * `line-height: 1.625` — and `mb-5` between blocks is Typography's `1.25em`
 * paragraph margin, which `.ProseMirror > p` zeroes at the top and keeps at the
 * bottom. A paragraph's last line is short, so the last bar of each is.
 */
export function EditorBodySkeleton({ count = 3 }: { count?: number }) {
	return (
		<div className="pl-12">
			<div className="min-h-[640px] w-full max-w-[42rem]">
				{Array.from({ length: count }, (_, index) => (
					<div className="mb-5 flex flex-col gap-2.5" key={index}>
						{PARAGRAPH_LINES[index % PARAGRAPH_LINES.length].map(
							(width, line) => (
								<Skeleton className={`h-4 ${width}`} key={line} />
							),
						)}
					</div>
				))}
			</div>
		</div>
	)
}
