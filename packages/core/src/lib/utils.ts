import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { BASE_PATH_REGEX } from './constants'

export const cn = (...inputs: ClassValue[]) => {
	return twMerge(clsx(inputs))
}

export const parseAdminPathname = ({
	basePath = BASE_PATH_REGEX,
	pathname,
}: {
	basePath?: string | RegExp
	pathname: string
}) => {
	const replaced = pathname.replace(basePath, '')
	const parts =
		replaced === '' ? [] : replaced.split('/').map(decodeURIComponent)

	if (parts.length === 0) {
		return { root: true }
	}

	if (parts.length < 2 || parts[0] !== 'collections') return null

	const collection = parts[1]
	if (parts.length === 2) {
		return { collection }
	}
	if (parts.length === 3 && parts[2] === 'new') {
		return { collection, action: 'create' as const }
	}
	if (parts.length === 3 && parts[2] !== 'new') {
		const slug = parts[2]
		return { collection, action: 'edit' as const, slug }
	}
	if (parts.length > 3 && parts[2] !== 'new') {
		const slug = parts.slice(2).join('/')
		return { collection, action: 'edit' as const, slug }
	}

	return null
}

export const parseOutputPathname = ({ pathname }: { pathname: string }) => {
	const parts = pathname.split('/').map(decodeURIComponent)

	if (parts.length === 2) {
		const collection = parts[1]
		return { collection, root: true, slug: null }
	}

	if (parts.length === 3) {
		const collection = parts[1]
		const slug = parts[2]
		return { collection, root: false, slug }
	}

	if (parts.length > 3) {
		const collection = parts[1]
		const slug = parts.slice(2).join('/')
		return { collection, root: false, slug }
	}

	return null
}
