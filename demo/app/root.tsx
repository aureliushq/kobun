import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from 'react-router'

import type { Route } from './+types/root'
import stylesheet from './app.css?url'

export const links: Route.LinksFunction = () => [
	{
		rel: 'preconnect',
		href: 'https://fonts.bunny.net',
		crossOrigin: 'anonymous',
	},
	{
		rel: 'stylesheet',
		href: 'https://fonts.bunny.net/css?family=inter:400,500,600,700',
	},
	{ rel: 'stylesheet', href: stylesheet },
	{
		rel: 'icon',
		type: 'image/png',
		href: '/site/favicon-96x96.png',
		sizes: '96x96',
	},
	{
		rel: 'icon',
		type: 'image/svg+xml',
		href: '/site/favicon.svg',
	},
	{
		rel: 'shortcut icon',
		href: '/site/favicon.ico',
	},
	{
		rel: 'apple-touch-icon',
		sizes: '180x180',
		href: '/site/apple-touch-icon.png',
	},
	{
		rel: 'manifest',
		href: '/site/site.webmanifest',
	},
]

export const meta: Route.MetaFunction = () => [
	{ title: 'Kobun Demo' },
	{
		name: 'description',
		content: 'Effortlessly build content sites with React Router v7',
	},
	{
		name: 'apple-mobile-web-app-title',
		content: 'Kobun',
	},
]

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<head>
				<meta charSet='utf-8' />
				<meta
					name='viewport'
					content='width=device-width, initial-scale=1'
				/>
				<Meta />
				<Links />
			</head>
			<body className='font-sans'>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export default function App() {
	return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = 'Oops!'
	let details = 'An unexpected error occurred.'
	let stack: string | undefined

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? '404' : 'Error'
		details =
			error.status === 404
				? 'The requested page could not be found.'
				: error.statusText || details
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message
		stack = error.stack
	}

	return (
		<main className='pt-16 p-4 container mx-auto'>
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className='w-full p-4 overflow-x-auto'>
					<code>{stack}</code>
				</pre>
			)}
		</main>
	)
}
