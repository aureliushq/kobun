import { Link } from 'react-router'
import { Button } from '~/components/ui/button'

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
						<Button size='sm'>Rescribe</Button>
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
					href='https://remix.run/docs/en/main'
					target='_blank'
					rel='noopener noreferrer'
				>
					<img
						aria-hidden
						src='/remix_logo_dark.png'
						alt='Globe icon'
						width={16}
						height={16}
					/>
					Remix Documentation →
				</a>
				<a
					className='flex items-center gap-2'
					href='https://reactrouter.com/'
					target='_blank'
					rel='noopener noreferrer'
				>
					<img
						aria-hidden
						src='/rr_logo_dark.png'
						alt='Globe icon'
						width={16}
						height={16}
					/>
					React Router v7 Documentation →
				</a>
			</footer>
		</div>
	)
}

export default Home
