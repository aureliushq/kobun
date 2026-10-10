import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "@/ui/lib/utils"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
	return (
		<AccordionPrimitive.Root
			data-slot="accordion"
			className={cn(
				"flex w-full flex-col overflow-hidden rounded-md border",
				className,
			)}
			{...props}
		/>
	)
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn("not-last:border-b data-open:bg-muted/50", className)}
			{...props}
		/>
	)
}

function AccordionContent({
	className,
	children,
	...props
}: AccordionPrimitive.Panel.Props) {
	return (
		<AccordionPrimitive.Panel
			data-slot="accordion-content"
			className="overflow-hidden px-2 text-xs/relaxed data-closed:animate-accordion-up data-open:animate-accordion-down"
			{...props}
		>
			<div
				className={cn(
					"h-(--accordion-panel-height) pt-0 pb-4 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
					className,
				)}
			>
				{children}
			</div>
		</AccordionPrimitive.Panel>
	)
}

export { Accordion, AccordionItem, AccordionContent }
