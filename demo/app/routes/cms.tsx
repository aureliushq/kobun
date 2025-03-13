import { Kobun } from '@kobun/core'
import { handleActions, handleLoaders } from '@kobun/server/cloudflare'
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
	handleLoaders({ ...args, config: kobunConfig })

const CMS = () => {
	return <Kobun />
}

export default CMS
