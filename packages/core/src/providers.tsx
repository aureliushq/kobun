import { createContext, type ReactNode } from 'react'
import type { Config } from './types'

export type RescribeContextData = {
	config: Config
}

const RescribeContext = createContext<RescribeContextData | null>(null)

type RescribeProviderProps = RescribeContextData & {
	children: ReactNode
}

const RescribeProvider = ({ config, children }: RescribeProviderProps) => (
	<RescribeContext.Provider value={{ config }}>
		{children}
	</RescribeContext.Provider>
)

export { RescribeProvider }
