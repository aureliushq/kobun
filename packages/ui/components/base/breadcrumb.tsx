import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import * as React from "react"
import { cn } from "@/ui/lib/utils"

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
	return (
		<nav
			aria-label="breadcrumb"
			data-slot="breadcrumb"
			className={cn(className)}
			{...props}
		/>
	)
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			data-slot="breadcrumb-list"
			className={cn(
				"wrap-break-word flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs/relaxed",
				className,
			)}
			{...props}
		/>
	)
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-item"
			className={cn("inline-flex items-center gap-1", className)}
			{...props}
		/>
	)
}

function BreadcrumbLink({
	className,
	render,
	...props
}: useRender.ComponentProps<"a">) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn("transition-colors hover:text-foreground", className),
			},
			props,
		),
		render,
		state: {
			slot: "breadcrumb-link",
		},
	})
}

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink }
