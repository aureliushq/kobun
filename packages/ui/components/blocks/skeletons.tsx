import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import { Skeleton } from "@/ui/components/base/skeleton"

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

export function PageHeaderSkeleton() {
	return (
		<div className="flex flex-col gap-2">
			{/* h-9 is the line box of `H2`'s text-3xl */}
			<Skeleton className="h-9 w-64" />
			<Skeleton className="h-5 w-96 max-w-full" />
		</div>
	)
}

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
