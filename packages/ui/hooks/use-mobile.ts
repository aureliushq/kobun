import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768

const mobileMediaQuery =
	typeof window !== "undefined"
		? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
		: null

function subscribeToMediaQuery(callback: () => void) {
	mobileMediaQuery?.addEventListener("change", callback)
	return () => mobileMediaQuery?.removeEventListener("change", callback)
}

function getIsMobile() {
	return mobileMediaQuery?.matches ?? false
}

function getServerIsMobile() {
	return false
}

export function useIsMobile() {
	return useSyncExternalStore(
		subscribeToMediaQuery,
		getIsMobile,
		getServerIsMobile,
	)
}
