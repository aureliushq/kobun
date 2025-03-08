import { Kobun } from '@kobun/core'
import { handleActions, handleLoader } from '@kobun/server/node'
import kobunConfig from '~/kobun.config'
import '@kobun/core/kobun.css'
import type { Route } from './+types/cms'

export const meta: Route.MetaFunction = () => [
	{ title: 'Kobun Demo' },
	{
		name: 'description',
		content: 'Effortlessly build content sites with React Router v7',
	},
]

export const action = async (args: Route.ActionArgs) =>
	handleActions({ ...args, config: kobunConfig })

export const loader = async (args: Route.LoaderArgs) =>
	handleLoader({ ...args, config: kobunConfig })

const CMS = () => {
	return <Kobun config={kobunConfig} />
}

export default CMS
