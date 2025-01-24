import { type ReactNode, createContext, useMemo } from 'react'
import { useLocation } from 'react-router'
import invariant from 'tiny-invariant'
import { parseAdminPathname } from '@/lib/utils'
import type { Config } from '@/types'

export type RescribeContextData = {
	config: Config | null
	params?: ReturnType<typeof parseAdminPathname>
}

export const RescribeContext = createContext<RescribeContextData>({
	config: null,
	params: null,
})

type RescribeProviderProps = RescribeContextData & {
	children: ReactNode
}

const RescribeProvider = ({ config, children }: RescribeProviderProps) => {
	invariant(
		config?.collections,
		'Cannot read collections from configuration. Is is valid?',
	)

	const location = useLocation()
	const params = useMemo(() => {
		return parseAdminPathname({
			collections: config?.collections,
			pathname: location.pathname,
		})
	}, [config, location.pathname])

	return (
		<RescribeContext.Provider value={{ config, params }}>
			{children}
		</RescribeContext.Provider>
	)
}

export { RescribeProvider }
