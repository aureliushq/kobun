import { Rescribe } from '@rescribe/core'
import rescribeConfig from '~/rescribe.config'
import '@rescribe/core/rescribe.css'
import type { Route } from './+types/cms'

export function meta() {
	return [
		{ title: 'New React Router App' },
		{ name: 'description', content: 'Welcome to React Router!' },
	]
}

export const loader = async () => {
	return { message: 'Hello from the server!' }
}

export const action = async ({ request }: Route.ActionArgs) => {
	const formData = await request.formData()
	return { message: 'Hello from the server!' }
}

const CMS = () => {
	return <Rescribe config={rescribeConfig} />
}

export default CMS
