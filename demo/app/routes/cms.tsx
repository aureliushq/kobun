import { Kobun } from '@kobun/core'
import { handleActions, handleLoaders } from '@kobun/server/cloudflare'
import '@kobun/core/kobun.css'

import kobunConfig from '~/kobun.config'
import type { Route } from './+types/cms'

export const meta: Route.MetaFunction = () => [
	{ title: 'Kobun Demo' },
	{
		name: 'description',
		content: 'Effortlessly build content sites with React Router v7',
	},
]

export const action = async (args: Route.ActionArgs) => {
	const credentials = {
		accessKeyId: process.env.ACCESS_KEY_ID as string,
		accountId: process.env.ACCOUNT_ID as string,
		bucketName: process.env.BUCKET_NAME as string,
		secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
	}
	// @ts-ignore
	kobunConfig.storage.credentials = credentials
	return handleActions({ ...args, config: kobunConfig })
}

export const loader = async (args: Route.LoaderArgs) => {
	const credentials = {
		accessKeyId: process.env.ACCESS_KEY_ID as string,
		accountId: process.env.ACCOUNT_ID as string,
		bucketName: process.env.BUCKET_NAME as string,
		secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
	}
	// @ts-ignore
	kobunConfig.storage.credentials = credentials
	return handleLoaders({ ...args, config: kobunConfig })
}

const CMS = () => {
	return <Kobun />
}

export default CMS
