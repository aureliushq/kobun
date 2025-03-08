import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
	index('routes/home.tsx'),
	route('blog', 'routes/blog.tsx', [
		index('routes/articles.tsx'),
		route(':slug', 'routes/article.tsx'),
	]),
	route('kobun/*', 'routes/cms.tsx'),
] satisfies RouteConfig
