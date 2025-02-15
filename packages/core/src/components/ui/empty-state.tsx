import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
	title: string
	description: string
	icons?: LucideIcon[]
	action?: React.ReactNode
	className?: string
}

export function EmptyState({
	title,
	description,
	icons = [],
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				'rs-bg-background rs-border-border hover:rs-border-border/80 rs-text-center',
				'rs-border-2 rs-border-dashed rs-rounded-xl rs-p-14 rs-w-full rs-max-w-[620px]',
				'rs-group hover:rs-bg-muted/50 rs-transition rs-duration-500 hover:rs-duration-200',
				className,
			)}
		>
			<div className='rs-flex rs-justify-center rs-isolate'>
				{icons.length === 3 ? (
					<>
						<div className='rs-bg-background rs-size-12 rs-grid rs-place-items-center rs-rounded-xl rs-relative rs-left-2.5 rs-top-1.5 -rs-rotate-6 rs-shadow-lg rs-ring-1 rs-ring-border group-hover:-rs-translate-x-5 group-hover:-rs-rotate-12 group-hover:-rs-translate-y-0.5 rs-transition rs-duration-500 group-hover:rs-duration-200'>
							{React.createElement(icons[0], {
								className:
									'rs-w-6 rs-h-6 rs-text-muted-foreground',
							})}
						</div>
						<div className='rs-bg-background rs-size-12 rs-grid rs-place-items-center rs-rounded-xl rs-relative rs-z-10 rs-shadow-lg rs-ring-1 rs-ring-border group-hover:-rs-translate-y-0.5 rs-transition rs-duration-500 group-hover:rs-duration-200'>
							{React.createElement(icons[1], {
								className:
									'rs-w-6 rs-h-6 rs-text-muted-foreground',
							})}
						</div>
						<div className='rs-bg-background rs-size-12 rs-grid rs-place-items-center rs-rounded-xl rs-relative rs-right-2.5 rs-top-1.5 rs-rotate-6 rs-shadow-lg rs-ring-1 rs-ring-border group-hover:rs-translate-x-5 group-hover:rs-rotate-12 group-hover:-rs-translate-y-0.5 rs-transition rs-duration-500 group-hover:rs-duration-200'>
							{React.createElement(icons[2], {
								className:
									'rs-w-6 rs-h-6 rs-text-muted-foreground',
							})}
						</div>
					</>
				) : (
					<div className='rs-bg-background rs-size-12 rs-grid rs-place-items-center rs-rounded-xl rs-shadow-lg rs-ring-1 rs-ring-border group-hover:-rs-translate-y-0.5 rs-transition rs-duration-500 group-hover:rs-duration-200'>
						{icons[0] &&
							React.createElement(icons[0], {
								className:
									'rs-w-6 rs-h-6 rs-text-muted-foreground',
							})}
					</div>
				)}
			</div>
			<h2 className='rs-text-foreground rs-font-medium rs-mt-6'>
				{title}
			</h2>
			<p className='rs-text-sm rs-text-muted-foreground rs-mt-1 rs-mb-4 rs-text-wrap rs-whitespace-pre-line'>
				{description}
			</p>
			{action}
		</div>
	)
}
