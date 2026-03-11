import {
	layout,
	prefix,
	type RouteConfig,
	route,
} from "@react-router/dev/routes"

export default [
	layout("core/components/layouts/dashboard.tsx", [
		// route("/:owner/:repo", "routes/dashboard.tsx"),
		route("/", "routes/dashboard.tsx"),
	]),
	layout("core/components/layouts/minimal.tsx", [
		route("/login", "routes/login.tsx"),
		route("/setup", "routes/setup.tsx"),
	]),
	...prefix("api", [
		route("auth/*", "routes/api.auth.$.ts"),
		route("set-theme", "routes/api.set-theme.ts"),
	]),
	route("/component-examples", "routes/example.tsx"),
] satisfies RouteConfig
