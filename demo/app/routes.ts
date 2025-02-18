import { type RouteConfig, index, route } from '@react-router/dev/routes'

// export default [
// 	index('routes/home.tsx'),
// 	route('rescribe/*', 'routes/cms.tsx'),
// ] satisfies RouteConfig
export default [
	route('/', 'routes/cms.tsx', [route('/*', 'routes/cms2.tsx')]),
] satisfies RouteConfig
