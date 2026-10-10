import type { ReactNode } from "react"

export function H1({ children }: { children: ReactNode }) {
	return (
		<h1 className="scroll-m-20 text-balance font-extrabold text-4xl tracking-tight">
			{children}
		</h1>
	)
}

export function H2({ children }: { children: ReactNode }) {
	return (
		<h2 className="scroll-m-20 text-balance font-semibold text-3xl tracking-tight first:mt-0">
			{children}
		</h2>
	)
}
