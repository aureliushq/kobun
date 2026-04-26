import {
	index,
	layout,
	prefix,
	type RouteConfig,
	route,
} from "@react-router/dev/routes"

export default [
	index("routes/index.tsx"),
	layout("core/components/layouts/dashboard.tsx", [
		route("/:owner/:name", "routes/dashboard.tsx"),
		route(
			"/:owner/:name/collections/:collection_slug",
			"routes/collection.tsx",
		),
		route("/:owner/:name/singletons/:singleton_slug", "routes/singleton.tsx"),
	]),
	layout("core/components/layouts/editor.tsx", [
		route(
			"/:owner/:name/collections/:collection_slug/editor/:collection_item_slug",
			"routes/collection-editor.tsx",
		),
	]),
	layout("core/components/layouts/minimal.tsx", [
		route("/login", "routes/login.tsx"),
		route("/setup", "routes/setup.tsx"),
	]),
	...prefix("api", [
		route("auth/*", "routes/api.auth.$.ts"),
		route("dashboard-actions", "routes/api.dashboard-actions.ts"),
		route("set-theme", "routes/api.set-theme.ts"),
	]),
	route("/component-examples", "routes/example.tsx"),
] satisfies RouteConfig
