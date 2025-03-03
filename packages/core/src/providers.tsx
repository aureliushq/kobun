import { type Config, parseAdminPathname } from '@kobun/common'
import { type ReactNode, createContext, useMemo } from 'react'
import { useLocation } from 'react-router'
import invariant from 'tiny-invariant'

export type KobunContextData = {
	config: Config | null
	params?: ReturnType<typeof parseAdminPathname>
}

export const KobunContext = createContext<KobunContextData>({
	config: null,
	params: null,
})

type KobunProviderProps = KobunContextData & {
	children: ReactNode
}

const KobunProvider = ({ config, children }: KobunProviderProps) => {
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
		<KobunContext.Provider value={{ config, params }}>
			{children}
		</KobunContext.Provider>
	)
}

export { KobunProvider }
