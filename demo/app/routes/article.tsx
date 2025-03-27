import { createReader } from '@kobun/server/cloudflare'
import { useLoaderData } from 'react-router'

import kobunConfig from '~/kobun.config'
import type { Route } from './+types/article'

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const credentials = {
		accessKeyId: process.env.ACCESS_KEY_ID as string,
		accountId: process.env.ACCOUNT_ID as string,
		bucketName: process.env.BUCKET_NAME as string,
		secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
	}
	// @ts-ignore
	kobunConfig.storage.credentials = credentials
	const url = new URL(request.url)
	const slug = url.pathname.replace('/blog/', '')
	const reader = createReader({ config: kobunConfig, context })
	const item = reader?.collections.articles.unique({ where: { slug } })
	return item
}

const Article = () => {
	const data = useLoaderData()

	console.log(data)

	return (
		<article className='max-w-2xl px-64'>
			<header>
				<h1>{data.title}</h1>
				<span>{data.publishedAt.toISOString()}</span>
			</header>
			{/* <div className='content'> */}
			{/* 	<Content /> */}
			{/* </div> */}
		</article>
	)
}

export default Article
