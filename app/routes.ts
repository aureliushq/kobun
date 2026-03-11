import {
	layout,
	prefix,
	type RouteConfig,
	route,
} from "@react-router/dev/routes"

export default [
	...prefix("api", [
		route("auth/*", "routes/api.auth.$.ts"),
		route("set-theme", "routes/api.set-theme.ts"),
	]),
	layout("core/components/layouts/dashboard.tsx", [
		route("/", "routes/dashboard.tsx"),
	]),
	route("/component-examples", "routes/example.tsx"),
	route("/login", "routes/login.tsx"),
	route("/setup", "routes/setup.tsx"),
] satisfies RouteConfig
