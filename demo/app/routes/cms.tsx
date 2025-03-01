import { Rescribe } from '@rescribejs/core'
import { handleActions, handleLoader } from '@rescribejs/server'
import rescribeConfig from '~/rescribe.config'
import '@rescribejs/core/rescribe.css'
import type { Route } from './+types/cms'

export const meta: Route.MetaFunction = () => [
	{ title: 'Rescribe Demo' },
	{
		name: 'description',
		content: 'Effortlessly build content sites with React Router v7',
	},
]

export const action = async (args: Route.ActionArgs) =>
	handleActions({ ...args, config: rescribeConfig })

export const loader = async (args: Route.LoaderArgs) =>
	handleLoader({ ...args, config: rescribeConfig })

const CMS = () => {
	return <Rescribe config={rescribeConfig} />
}

export default CMS
