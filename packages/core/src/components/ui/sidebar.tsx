import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { PanelLeft } from 'lucide-react'
import * as React from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Separator } from '~/components/ui/separator'
import { Sheet, SheetContent } from '~/components/ui/sheet'
import { Skeleton } from '~/components/ui/skeleton'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '~/components/ui/tooltip'
import { useIsMobile } from '~/hooks/use-mobile'
import { cn } from '~/lib/utils'

const SIDEBAR_COOKIE_NAME = 'sidebar:state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

type SidebarContext = {
	state: 'expanded' | 'collapsed'
	open: boolean
	setOpen: (open: boolean) => void
	openMobile: boolean
	setOpenMobile: (open: boolean) => void
	isMobile: boolean
	toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
	const context = React.useContext(SidebarContext)
	if (!context) {
		throw new Error('useSidebar must be used within a SidebarProvider.')
	}

	return context
}

const SidebarProvider = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & {
		defaultOpen?: boolean
		open?: boolean
		onOpenChange?: (open: boolean) => void
	}
>(
	(
		{
			defaultOpen = true,
			open: openProp,
			onOpenChange: setOpenProp,
			className,
			style,
			children,
			...props
		},
		ref,
	) => {
		const isMobile = useIsMobile()
		const [openMobile, setOpenMobile] = React.useState(false)

		// This is the internal state of the sidebar.
		// We use openProp and setOpenProp for control from outside the component.
		const [_open, _setOpen] = React.useState(defaultOpen)
		const open = openProp ?? _open
		const setOpen = React.useCallback(
			(value: boolean | ((value: boolean) => boolean)) => {
				const openState =
					typeof value === 'function' ? value(open) : value
				if (setOpenProp) {
					setOpenProp(openState)
				} else {
					_setOpen(openState)
				}

				// This sets the cookie to keep the sidebar state.
				document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
			},
			[setOpenProp, open],
		)

		// Helper to toggle the sidebar.
		// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
		const toggleSidebar = React.useCallback(() => {
			return isMobile
				? setOpenMobile((open) => !open)
				: setOpen((open) => !open)
		}, [isMobile, setOpen, setOpenMobile])

		// Adds a keyboard shortcut to toggle the sidebar.
		React.useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				if (
					event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
					(event.metaKey || event.ctrlKey)
				) {
					event.preventDefault()
					toggleSidebar()
				}
			}

			window.addEventListener('keydown', handleKeyDown)
			return () => window.removeEventListener('keydown', handleKeyDown)
		}, [toggleSidebar])

		// We add a state so that we can do data-state="expanded" or "collapsed".
		// This makes it easier to style the sidebar with Tailwind classes.
		const state = open ? 'expanded' : 'collapsed'

		// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
		const contextValue = React.useMemo<SidebarContext>(
			() => ({
				state,
				open,
				setOpen,
				isMobile,
				openMobile,
				setOpenMobile,
				toggleSidebar,
			}),
			[
				state,
				open,
				setOpen,
				isMobile,
				openMobile,
				setOpenMobile,
				toggleSidebar,
			],
		)

		return (
			<SidebarContext.Provider value={contextValue}>
				<TooltipProvider delayDuration={0}>
					<div
						style={
							{
								'--sidebar-width': SIDEBAR_WIDTH,
								'--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
								...style,
							} as React.CSSProperties
						}
						className={cn(
							'rs-group/sidebar-wrapper rs-flex rs-min-h-svh rs-w-full has-[[data-variant=inset]]:rs-bg-sidebar',
							className,
						)}
						ref={ref}
						{...props}
					>
						{children}
					</div>
				</TooltipProvider>
			</SidebarContext.Provider>
		)
	},
)
SidebarProvider.displayName = 'SidebarProvider'

const Sidebar = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & {
		side?: 'left' | 'right'
		variant?: 'sidebar' | 'floating' | 'inset'
		collapsible?: 'offcanvas' | 'icon' | 'none'
	}
>(
	(
		{
			side = 'left',
			variant = 'sidebar',
			collapsible = 'offcanvas',
			className,
			children,
			...props
		},
		ref,
	) => {
		const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

		if (collapsible === 'none') {
			return (
				<div
					className={cn(
						'rs-flex rs-h-full rs-w-[--sidebar-width] rs-flex-col rs-bg-sidebar rs-text-sidebar-foreground',
						className,
					)}
					ref={ref}
					{...props}
				>
					{children}
				</div>
			)
		}

		if (isMobile) {
			return (
				<Sheet
					open={openMobile}
					onOpenChange={setOpenMobile}
					{...props}
				>
					<SheetContent
						data-sidebar='sidebar'
						data-mobile='true'
						className='rs-w-[--sidebar-width] rs-bg-sidebar rs-p-0 rs-text-sidebar-foreground [&>button]:rs-hidden'
						style={
							{
								'--sidebar-width': SIDEBAR_WIDTH_MOBILE,
							} as React.CSSProperties
						}
						side={side}
					>
						<div className='rs-flex rs-h-full rs-w-full rs-flex-col'>
							{children}
						</div>
					</SheetContent>
				</Sheet>
			)
		}

		return (
			<div
				ref={ref}
				className='rs-group rs-peer rs-hidden md:rs-block rs-text-sidebar-foreground'
				data-state={state}
				data-collapsible={state === 'collapsed' ? collapsible : ''}
				data-variant={variant}
				data-side={side}
			>
				{/* This is what handles the sidebar gap on desktop */}
				<div
					className={cn(
						'rs-duration-200 rs-relative rs-h-svh rs-w-[--sidebar-width] rs-bg-transparent rs-transition-[width] rs-ease-linear',
						'group-data-[collapsible=offcanvas]:rs-w-0',
						'group-data-[side=right]:rs-rotate-180',
						variant === 'floating' || variant === 'inset'
							? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]'
							: 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]',
					)}
				/>
				<div
					className={cn(
						'rs-duration-200 rs-fixed rs-inset-y-0 rs-z-10 rs-hidden rs-h-svh rs-w-[--sidebar-width] rs-transition-[left,right,width] rs-ease-linear md:rs-flex',
						side === 'left'
							? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
							: 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
						// Adjust the padding for floating and inset variants.
						variant === 'floating' || variant === 'inset'
							? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]'
							: 'group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l',
						className,
					)}
					{...props}
				>
					<div
						data-sidebar='sidebar'
						className='rs-flex rs-h-full rs-w-full rs-flex-col rs-bg-sidebar group-data-[variant=floating]:rs-rounded-lg group-data-[variant=floating]:rs-border group-data-[variant=floating]:rs-border-sidebar-border group-data-[variant=floating]:rs-shadow'
					>
						{children}
					</div>
				</div>
			</div>
		)
	},
)
Sidebar.displayName = 'Sidebar'

const SidebarTrigger = React.forwardRef<
	React.ElementRef<typeof Button>,
	React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
	const { toggleSidebar } = useSidebar()

	return (
		<Button
			ref={ref}
			data-sidebar='trigger'
			variant='ghost'
			size='icon'
			className={cn('rs-h-7 rs-w-7', className)}
			onClick={(event) => {
				onClick?.(event)
				toggleSidebar()
			}}
			{...props}
		>
			<PanelLeft />
			<span className='rs-sr-only'>Toggle Sidebar</span>
		</Button>
	)
})
SidebarTrigger.displayName = 'SidebarTrigger'

const SidebarRail = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<'button'>
>(({ className, ...props }, ref) => {
	const { toggleSidebar } = useSidebar()

	return (
		<button
			ref={ref}
			data-sidebar='rail'
			aria-label='Toggle Sidebar'
			tabIndex={-1}
			onClick={toggleSidebar}
			title='Toggle Sidebar'
			className={cn(
				'rs-absolute rs-inset-y-0 rs-z-20 rs-hidden rs-w-4 -rs-translate-x-1/2 rs-transition-all rs-ease-linear after:rs-absolute after:rs-inset-y-0 after:rs-left-1/2 after:rs-w-[2px] hover:after:rs-bg-sidebar-border group-data-[side=left]:-rs-right-4 group-data-[side=right]:rs-left-0 sm:rs-flex',
				'[[data-side=left]_&]:rs-cursor-w-resize [[data-side=right]_&]:rs-cursor-e-resize',
				'[[data-side=left][data-state=collapsed]_&]:rs-cursor-e-resize [[data-side=right][data-state=collapsed]_&]:rs-cursor-w-resize',
				'group-data-[collapsible=offcanvas]:rs-translate-x-0 group-data-[collapsible=offcanvas]:after:rs-left-full group-data-[collapsible=offcanvas]:hover:rs-bg-sidebar',
				'[[data-side=left][data-collapsible=offcanvas]_&]:-rs-right-2',
				'[[data-side=right][data-collapsible=offcanvas]_&]:-rs-left-2',
				className,
			)}
			{...props}
		/>
	)
})
SidebarRail.displayName = 'SidebarRail'

const SidebarInset = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'main'>
>(({ className, ...props }, ref) => {
	return (
		<main
			ref={ref}
			className={cn(
				'rs-relative rs-flex rs-min-h-svh rs-flex-1 rs-flex-col rs-bg-background',
				'peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
				className,
			)}
			{...props}
		/>
	)
})
SidebarInset.displayName = 'SidebarInset'

const SidebarInput = React.forwardRef<
	React.ElementRef<typeof Input>,
	React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
	return (
		<Input
			ref={ref}
			data-sidebar='input'
			className={cn(
				'rs-h-8 rs-w-full rs-bg-background rs-shadow-none focus-visible:rs-ring-2 focus-visible:rs-ring-sidebar-ring',
				className,
			)}
			{...props}
		/>
	)
})
SidebarInput.displayName = 'SidebarInput'

const SidebarHeader = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-sidebar='header'
			className={cn('rs-flex rs-flex-col rs-gap-2 rs-p-2', className)}
			{...props}
		/>
	)
})
SidebarHeader.displayName = 'SidebarHeader'

const SidebarFooter = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-sidebar='footer'
			className={cn('rs-flex rs-flex-col rs-gap-2 rs-p-2', className)}
			{...props}
		/>
	)
})
SidebarFooter.displayName = 'SidebarFooter'

const SidebarSeparator = React.forwardRef<
	React.ElementRef<typeof Separator>,
	React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
	return (
		<Separator
			ref={ref}
			data-sidebar='separator'
			className={cn('rs-mx-2 rs-w-auto rs-bg-sidebar-border', className)}
			{...props}
		/>
	)
})
SidebarSeparator.displayName = 'SidebarSeparator'

const SidebarContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-sidebar='content'
			className={cn(
				'rs-flex rs-min-h-0 rs-flex-1 rs-flex-col rs-gap-2 rs-overflow-auto group-data-[collapsible=icon]:rs-overflow-hidden',
				className,
			)}
			{...props}
		/>
	)
})
SidebarContent.displayName = 'SidebarContent'

const SidebarGroup = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-sidebar='group'
			className={cn(
				'rs-relative rs-flex rs-w-full rs-min-w-0 rs-flex-col rs-p-2',
				className,
			)}
			{...props}
		/>
	)
})
SidebarGroup.displayName = 'SidebarGroup'

const SidebarGroupLabel = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'div'

	return (
		<Comp
			ref={ref}
			data-sidebar='group-label'
			className={cn(
				'rs-duration-200 rs-flex rs-h-8 rs-shrink-0 rs-items-center rs-rounded-md rs-px-2 rs-text-xs rs-font-medium rs-text-sidebar-foreground/70 rs-outline-none rs-ring-sidebar-ring rs-transition-[margin,opa] rs-ease-linear focus-visible:rs-ring-2 [&>svg]:rs-size-4 [&>svg]:rs-shrink-0',
				'group-data-[collapsible=icon]:-rs-mt-8 group-data-[collapsible=icon]:rs-opacity-0',
				className,
			)}
			{...props}
		/>
	)
})
SidebarGroupLabel.displayName = 'SidebarGroupLabel'

const SidebarGroupAction = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<'button'> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button'

	return (
		<Comp
			ref={ref}
			data-sidebar='group-action'
			className={cn(
				'rs-absolute rs-right-3 rs-top-3.5 rs-flex rs-aspect-square rs-w-5 rs-items-center rs-justify-center rs-rounded-md rs-p-0 rs-text-sidebar-foreground rs-outline-none rs-ring-sidebar-ring rs-transition-transform hover:rs-bg-sidebar-accent hover:rs-text-sidebar-accent-foreground focus-visible:rs-ring-2 [&>svg]:rs-size-4 [&>svg]:rs-shrink-0',
				// Increases the hit area of the button on mobile.
				'after:rs-absolute after:-rs-inset-2 after:md:rs-hidden',
				'group-data-[collapsible=icon]:rs-hidden',
				className,
			)}
			{...props}
		/>
	)
})
SidebarGroupAction.displayName = 'SidebarGroupAction'

const SidebarGroupContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='group-content'
		className={cn('rs-w-full rs-text-sm', className)}
		{...props}
	/>
))
SidebarGroupContent.displayName = 'SidebarGroupContent'

const SidebarMenu = React.forwardRef<
	HTMLUListElement,
	React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
	<ul
		ref={ref}
		data-sidebar='menu'
		className={cn(
			'rs-flex rs-w-full rs-min-w-0 rs-flex-col rs-gap-1',
			className,
		)}
		{...props}
	/>
))
SidebarMenu.displayName = 'SidebarMenu'

const SidebarMenuItem = React.forwardRef<
	HTMLLIElement,
	React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
	<li
		ref={ref}
		data-sidebar='menu-item'
		className={cn('rs-group/menu-item rs-relative', className)}
		{...props}
	/>
))
SidebarMenuItem.displayName = 'SidebarMenuItem'

const sidebarMenuButtonVariants = cva(
	'rs-peer/menu-button rs-flex rs-w-full rs-items-center rs-gap-2 rs-overflow-hidden rs-rounded-md rs-p-2 rs-text-left rs-text-sm rs-outline-none rs-ring-sidebar-ring rs-transition-[width,height,padding] hover:rs-bg-sidebar-accent hover:rs-text-sidebar-accent-foreground focus-visible:rs-ring-2 active:rs-bg-sidebar-accent active:rs-text-sidebar-accent-foreground disabled:rs-pointer-events-none disabled:rs-opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:rs-pr-8 aria-disabled:rs-pointer-events-none aria-disabled:rs-opacity-50 data-[active=true]:rs-bg-sidebar-accent data-[active=true]:rs-font-medium data-[active=true]:rs-text-sidebar-accent-foreground data-[state=open]:hover:rs-bg-sidebar-accent data-[state=open]:hover:rs-text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:rs-truncate [&>svg]:rs-size-4 [&>svg]:rs-shrink-0',
	{
		variants: {
			variant: {
				default:
					'hover:rs-bg-sidebar-accent hover:rs-text-sidebar-accent-foreground',
				outline:
					'rs-bg-background rs-shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:rs-bg-sidebar-accent hover:rs-text-sidebar-accent-foreground hover:rs-shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
			},
			size: {
				default: 'rs-h-8 rs-text-sm',
				sm: 'rs-h-7 rs-text-xs',
				lg: 'rs-h-12 rs-text-sm group-data-[collapsible=icon]:!p-0',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

const SidebarMenuButton = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<'button'> & {
		asChild?: boolean
		isActive?: boolean
		tooltip?: string | React.ComponentProps<typeof TooltipContent>
	} & VariantProps<typeof sidebarMenuButtonVariants>
>(
	(
		{
			asChild = false,
			isActive = false,
			variant = 'default',
			size = 'default',
			tooltip,
			className,
			...props
		},
		ref,
	) => {
		const Comp = asChild ? Slot : 'button'
		const { isMobile, state } = useSidebar()

		const button = (
			<Comp
				ref={ref}
				data-sidebar='menu-button'
				data-size={size}
				data-active={isActive}
				className={cn(
					sidebarMenuButtonVariants({ variant, size }),
					className,
				)}
				{...props}
			/>
		)

		if (!tooltip) {
			return button
		}

		if (typeof tooltip === 'string') {
			tooltip = {
				children: tooltip,
			}
		}

		return (
			<Tooltip>
				<TooltipTrigger asChild>{button}</TooltipTrigger>
				<TooltipContent
					side='right'
					align='center'
					hidden={state !== 'collapsed' || isMobile}
					{...tooltip}
				/>
			</Tooltip>
		)
	},
)
SidebarMenuButton.displayName = 'SidebarMenuButton'

const SidebarMenuAction = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<'button'> & {
		asChild?: boolean
		showOnHover?: boolean
	}
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button'

	return (
		<Comp
			ref={ref}
			data-sidebar='menu-action'
			className={cn(
				'rs-absolute rs-right-1 rs-top-1.5 rs-flex rs-aspect-square rs-w-5 rs-items-center rs-justify-center rs-rounded-md rs-p-0 rs-text-sidebar-foreground rs-outline-none rs-ring-sidebar-ring rs-transition-transform hover:rs-bg-sidebar-accent hover:rs-text-sidebar-accent-foreground focus-visible:rs-ring-2 peer-hover/menu-button:rs-text-sidebar-accent-foreground [&>svg]:rs-size-4 [&>svg]:rs-shrink-0',
				// Increases the hit area of the button on mobile.
				'after:rs-absolute after:-rs-inset-2 after:md:rs-hidden',
				'peer-data-[size=sm]/menu-button:rs-top-1',
				'peer-data-[size=default]/menu-button:rs-top-1.5',
				'peer-data-[size=lg]/menu-button:rs-top-2.5',
				'group-data-[collapsible=icon]:rs-hidden',
				showOnHover &&
					'group-focus-within/menu-item:rs-opacity-100 group-hover/menu-item:rs-opacity-100 data-[state=open]:rs-opacity-100 peer-data-[active=true]/menu-button:rs-text-sidebar-accent-foreground md:rs-opacity-0',
				className,
			)}
			{...props}
		/>
	)
})
SidebarMenuAction.displayName = 'SidebarMenuAction'

const SidebarMenuBadge = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='menu-badge'
		className={cn(
			'rs-absolute rs-right-1 rs-flex rs-h-5 rs-min-w-5 rs-items-center rs-justify-center rs-rounded-md rs-px-1 rs-text-xs rs-font-medium rs-tabular-nums rs-text-sidebar-foreground rs-select-none rs-pointer-events-none',
			'peer-hover/menu-button:rs-text-sidebar-accent-foreground peer-data-[active=true]/menu-button:rs-text-sidebar-accent-foreground',
			'peer-data-[size=sm]/menu-button:rs-top-1',
			'peer-data-[size=default]/menu-button:rs-top-1.5',
			'peer-data-[size=lg]/menu-button:rs-top-2.5',
			'group-data-[collapsible=icon]:rs-hidden',
			className,
		)}
		{...props}
	/>
))
SidebarMenuBadge.displayName = 'SidebarMenuBadge'

const SidebarMenuSkeleton = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & {
		showIcon?: boolean
	}
>(({ className, showIcon = false, ...props }, ref) => {
	// Random width between 50 to 90%.
	const width = React.useMemo(() => {
		return `${Math.floor(Math.random() * 40) + 50}%`
	}, [])

	return (
		<div
			ref={ref}
			data-sidebar='menu-skeleton'
			className={cn(
				'rs-rounded-md rs-h-8 rs-flex rs-gap-2 rs-px-2 rs-items-center',
				className,
			)}
			{...props}
		>
			{showIcon && (
				<Skeleton
					className='rs-size-4 rs-rounded-md'
					data-sidebar='menu-skeleton-icon'
				/>
			)}
			<Skeleton
				className='rs-h-4 rs-flex-1 rs-max-w-[--skeleton-width]'
				data-sidebar='menu-skeleton-text'
				style={
					{
						'--skeleton-width': width,
					} as React.CSSProperties
				}
			/>
		</div>
	)
})
SidebarMenuSkeleton.displayName = 'SidebarMenuSkeleton'

const SidebarMenuSub = React.forwardRef<
	HTMLUListElement,
	React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
	<ul
		ref={ref}
		data-sidebar='menu-sub'
		className={cn(
			'rs-mx-3.5 rs-flex rs-min-w-0 rs-translate-x-px rs-flex-col rs-gap-1 rs-border-l rs-border-sidebar-border rs-px-2.5 rs-py-0.5',
			'group-data-[collapsible=icon]:rs-hidden',
			className,
		)}
		{...props}
	/>
))
SidebarMenuSub.displayName = 'SidebarMenuSub'

const SidebarMenuSubItem = React.forwardRef<
	HTMLLIElement,
	React.ComponentProps<'li'>
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem'

const SidebarMenuSubButton = React.forwardRef<
	HTMLAnchorElement,
	React.ComponentProps<'a'> & {
		asChild?: boolean
		size?: 'sm' | 'md'
		isActive?: boolean
	}
>(({ asChild = false, size = 'md', isActive, className, ...props }, ref) => {
	const Comp = asChild ? Slot : 'a'

	return (
		<Comp
			ref={ref}
			data-sidebar='menu-sub-button'
			data-size={size}
			data-active={isActive}
			className={cn(
				'rs-flex rs-h-7 rs-min-w-0 -rs-translate-x-px rs-items-center rs-gap-2 rs-overflow-hidden rs-rounded-md rs-px-2 rs-text-sidebar-foreground rs-outline-none rs-ring-sidebar-ring hover:rs-bg-sidebar-accent hover:rs-text-sidebar-accent-foreground focus-visible:rs-ring-2 active:rs-bg-sidebar-accent active:rs-text-sidebar-accent-foreground disabled:rs-pointer-events-none disabled:rs-opacity-50 aria-disabled:rs-pointer-events-none aria-disabled:rs-opacity-50 [&>span:last-child]:rs-truncate [&>svg]:rs-size-4 [&>svg]:rs-shrink-0 [&>svg]:rs-text-sidebar-accent-foreground',
				'data-[active=true]:rs-bg-sidebar-accent data-[active=true]:rs-text-sidebar-accent-foreground',
				size === 'sm' && 'rs-text-xs',
				size === 'md' && 'rs-text-sm',
				'group-data-[collapsible=icon]:rs-hidden',
				className,
			)}
			{...props}
		/>
	)
})
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton'

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
	SIDEBAR_WIDTH,
	SIDEBAR_WIDTH_MOBILE,
	SIDEBAR_WIDTH_ICON,
}
