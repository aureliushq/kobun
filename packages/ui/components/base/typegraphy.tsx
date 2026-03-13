import type { ReactNode } from "react"

export function H1({ children }: { children: ReactNode }) {
	return (
		<h1 className="scroll-m-20 text-balance text-center font-extrabold text-4xl tracking-tight">
			{children}
		</h1>
	)
}

export function H2({ children }: { children: ReactNode }) {
	return (
		<h2 className="scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0">
			{children}
		</h2>
	)
}

export function H3({ children }: { children: ReactNode }) {
	return (
		<h3 className="scroll-m-20 font-semibold text-2xl tracking-tight">
			{children}
		</h3>
	)
}

export function H4({ children }: { children: ReactNode }) {
	return (
		<h4 className="scroll-m-20 font-semibold text-xl tracking-tight">
			{children}
		</h4>
	)
}
