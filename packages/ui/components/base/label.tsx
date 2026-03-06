"use client"

import * as React from "react"

import { cn } from "@/ui/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: will be passed via props
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 font-medium text-xs/relaxed leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		/>
	)
}

export { Label }
