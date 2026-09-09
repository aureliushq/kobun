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
		// Project-scoped, so unlike `/settings` it belongs under the layout that
		// resolves a Project — and under the one wrapper that renders rather than
		// redirects when its Config will not read (ADR-0007, ADR-0010).
		route("/:owner/:name/settings", "routes/project-settings.tsx"),
	]),
	layout("core/components/layouts/editor.tsx", [
		route(
			"/:owner/:name/collections/:collection_slug/editor/:editor_mode/:collection_item_slug?",
			"routes/collection-editor.tsx",
		),
		route(
			"/:owner/:name/singletons/:singleton_slug/editor",
			"routes/singleton-editor.tsx",
		),
		route(
			"/:owner/:name/singletons/:singleton_slug/editor/:field_key/:item_index",
			"routes/singleton-item-editor.tsx",
		),
	]),
	layout("core/components/layouts/minimal.tsx", [
		route("/login", "routes/login.tsx"),
		route("/setup", "routes/setup.tsx"),
	]),
	// Account-scoped, so there is no `/:owner/:name` parent to inherit from and
	// no Project in the URL — which is the point, and the reason it cannot sit
	// under the dashboard layout (ADR-0010).
	layout("core/components/layouts/settings.tsx", [
		route("/settings", "routes/settings.tsx"),
	]),
	...prefix("api", [
		route("auth/*", "routes/api.auth.$.ts"),
		route("dashboard-actions", "routes/api.dashboard-actions.ts"),
		route(
			"editor/:owner/:name/collections/:collection_slug/editor/:editor_mode/:collection_item_slug?",
			"routes/api.collection-editor.ts",
		),
		route("repo-asset/:owner/:name/*", "routes/api.repo-asset.ts"),
		route(
			"set-editor-primary-action",
			"routes/api.set-editor-primary-action.ts",
		),
		route("set-theme", "routes/api.set-theme.ts"),
	]),
	route("/component-examples", "routes/example.tsx"),
] satisfies RouteConfig
