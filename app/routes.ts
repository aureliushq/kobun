import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	index("routes/login.tsx"),
	route("/api/auth/*", "routes/api.auth.$.ts"),
	route("/component-example", "routes/example.tsx"),
	route("/dashboard", "routes/dashboard.tsx"),
] satisfies RouteConfig;
