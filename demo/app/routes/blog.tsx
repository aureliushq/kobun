import { Outlet, useLoaderData } from 'react-router'

const Blog = () => {
	return (
		<div className='flex flex-col gap-4 p-32'>
			<Outlet />
		</div>
	)
}

export default Blog
