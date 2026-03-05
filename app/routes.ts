import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes"

export default [
	index("routes/login.tsx"),
	route("/api/auth/*", "routes/api.auth.$.ts"),
	route("/api/set-theme", "routes/api.set-theme.ts"),
	route("/component-example", "routes/example.tsx"),
	layout("core/components/layouts/dashboard.tsx", [
		route("/dashboard", "routes/dashboard.tsx"),
	]),
] satisfies RouteConfig
