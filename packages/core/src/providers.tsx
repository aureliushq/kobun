import { type Config, parseAdminPathname } from '@kobun/common'
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react'
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
			search: location.search,
			singletons: config.singletons,
		})
	}, [config, location.pathname, location.search])

	return (
		<KobunContext.Provider value={{ config, params }}>
			{children}
		</KobunContext.Provider>
	)
}

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
	children: React.ReactNode
	defaultTheme?: Theme
	storageKey?: string
}

type ThemeProviderState = {
	theme: Theme
	setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
	theme: 'system',
	setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function ThemeProvider({
	children,
	defaultTheme = 'system',
	storageKey = 'kobun-theme',
	...props
}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>()

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		setTheme(
			() => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
		)
	}, [])

	useEffect(() => {
		const root = window.document.body

		root.classList.remove('rs-light', 'rs-dark')
		root.classList.remove('light', 'dark')

		if (theme === 'system') {
			const systemTheme = window.matchMedia(
				'(prefers-color-scheme: dark)',
			).matches
				? 'rs-dark'
				: 'rs-light'

			root.classList.add(systemTheme)
			root.classList.add(systemTheme === 'rs-dark' ? 'dark' : 'light')
			return
		}

		root.classList.add(
			(theme as string) === 'dark' ? 'rs-dark' : 'rs-light',
		)
		root.classList.add((theme as string) === 'dark' ? 'dark' : 'light')
	}, [theme])

	const value = {
		theme,
		setTheme: (theme: Theme) => {
			localStorage.setItem(storageKey, theme)
			setTheme(theme)
		},
	}

	return (
		<ThemeProviderContext.Provider
			{...props}
			value={value as ThemeProviderState}
		>
			{children}
		</ThemeProviderContext.Provider>
	)
}

const useTheme = () => {
	const context = useContext(ThemeProviderContext)

	if (context === undefined)
		throw new Error('useTheme must be used within a ThemeProvider')

	return context
}

export { KobunProvider, ThemeProvider, useTheme }
