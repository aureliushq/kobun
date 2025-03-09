import { createReader } from '@kobun/server/node'
import { useLoaderData } from 'react-router'

import kobunConfig from '~/kobun.config'
import type { Route } from './+types/article'

export const loader = async ({ request }: Route.LoaderArgs) => {
	const url = new URL(request.url)
	const slug = url.pathname.replace('/blog/', '')
	const reader = createReader(kobunConfig)
	const blog = reader?.articles
	const item = await blog?.unique({ where: { slug } })
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
