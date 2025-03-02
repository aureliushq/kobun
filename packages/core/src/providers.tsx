import { type Config, parseAdminPathname } from '@runica/common'
import { type ReactNode, createContext, useMemo } from 'react'
import { useLocation } from 'react-router'
import invariant from 'tiny-invariant'

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
			basePath: config.basePath,
			collections: config.collections,
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
