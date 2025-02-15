import { cn } from '@/lib/utils'

function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn('rs-animate-pulse rs-rounded-md rs-bg-muted', className)}
			{...props}
		/>
	)
}

export { Skeleton }
