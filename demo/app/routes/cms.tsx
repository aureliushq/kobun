import { Rescribe } from '@rescribe/core'
import { handleLoader } from '@rescribe/server'
import rescribeConfig from '~/rescribe.config'
import '@rescribe/core/rescribe.css'
import type { Route } from './+types/cms'

export const meta: Route.MetaFunction = () => [
	{ title: 'Rescribe Demo' },
	{
		name: 'description',
		content: 'Effortlessly build content sites with React Router v7',
	},
]

export const loader = async (args: Route.LoaderArgs) =>
	handleLoader({ ...args, config: rescribeConfig })

export const action = async ({ request }: Route.ActionArgs) => {
	const formData = await request.formData()
	return { message: 'Hello from the server!' }
}

const CMS = () => {
	return <Rescribe config={rescribeConfig} />
}

export default CMS
