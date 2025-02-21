import { ExternalLinkIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import type { Route } from './+types/home'

export const meta: Route.MetaFunction = () => [
	{ title: 'Rescribe Demo' },
	{
		name: 'description',
		content: 'Effortlessly build content sites with React Router v7',
	},
]

const Home = () => {
	return (
		<div className='grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-20 gap-16'>
			<main className='flex flex-col gap-8 row-start-2 px-4'>
				<img
					src='/logo-dark.png'
					alt='Rescribe logo'
					width={180}
					height={38}
				/>
				<ol>
					<li>
						Get started by editing{' '}
						<code className='px-1 py-2 rounded-[4px] font-semibold'>
							rescribe.config.ts
						</code>
						.
					</li>
					<li>Save and see your changes instantly.</li>
				</ol>

				<div className='flex gap-4'>
					<Link to='/rescribe' rel='noopener noreferrer'>
						<Button size='sm'>Go to Rescribe</Button>
					</Link>
					<Link
						to='https://rescribe.site/docs'
						target='_blank'
						rel='noopener noreferrer'
					>
						<Button size='sm' variant='secondary'>
							Rescribe Documentation
						</Button>
					</Link>
				</div>
			</main>
			<footer className='flex gap-6 row-start-3'>
				<a
					className='flex items-center gap-2'
					href='https://reactrouter.com/docs'
					target='_blank'
					rel='noopener noreferrer'
				>
					<img
						aria-hidden
						className='w-5'
						src='/rr_logo_dark.png'
						alt='Globe icon'
					/>
					React Router Docs
					<ExternalLinkIcon className='w-4 h-4' />
				</a>
			</footer>
		</div>
	)
}

export default Home
