import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/ui/lib/utils"

const itemVariants = cva(
	"group/item flex w-full flex-wrap items-center rounded-md border text-xs/relaxed outline-none transition-colors duration-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted",
	{
		variants: {
			variant: {
				default: "border-transparent",
				outline: "border-border",
				muted: "border-transparent bg-muted/50",
			},
			size: {
				default: "gap-2.5 px-3 py-2.5",
				sm: "gap-2.5 px-3 py-2.5",
				xs: "gap-2.5 in-data-[slot=dropdown-menu-content]:p-0 px-2.5 py-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

function Item({
	className,
	variant = "default",
	size = "default",
	render,
	...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(itemVariants({ variant, size, className })),
			},
			props,
		),
		render,
		state: {
			slot: "item",
			variant,
			size,
		},
	})
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-content"
			className={cn(
				"flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0.5 [&+[data-slot=item-content]]:flex-none",
				className,
			)}
			{...props}
		/>
	)
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-title"
			className={cn(
				"line-clamp-1 flex w-fit items-center gap-2 font-medium text-xs/relaxed leading-snug underline-offset-4",
				className,
			)}
			{...props}
		/>
	)
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-actions"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	)
}

export { Item, ItemContent, ItemActions, ItemTitle }
