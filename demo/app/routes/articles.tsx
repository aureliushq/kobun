import { createReader } from '@kobun/server/node'
import { Link, useLoaderData } from 'react-router'

import kobunConfig from '~/kobun.config'

export const loader = async () => {
	const reader = createReader(kobunConfig)
	const blog = reader?.articles
	const items = await blog?.all({ filters: { status: 'published' } })
	return items
}

const Articles = () => {
	const data = useLoaderData()

	return (
		<div className='flex flex-col gap-4 p-32'>
			{data.map(
				// @ts-ignore
				(item) => (
					<article key={item.id}>
						<div className='flex items-baseline justify-between gap-4'>
							<Link
								className='text-lg decoration-none text-primary'
								to={`/blog/${item.slug}`}
							>
								{item.title}
							</Link>
							{item.publishedAt && (
								<span>{item.publishedAt.toISOString()}</span>
							)}
						</div>
						<p className='text-muted-foreground'>{item.excerpt}</p>
						{item.tags && (
							<div className='flex gap-2 mt-2'>
								{item.tags.map((tag: string) => (
									<span
										className='bg-accent text-accent-foreground rounded-full px-3 py-0.5 text-xs'
										key={tag}
									>
										{tag}
									</span>
								))}
							</div>
						)}
					</article>
				),
			)}
		</div>
	)
}

export default Articles
