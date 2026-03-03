import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	index("routes/login.tsx"),
	route("/component-example", "routes/example.tsx"),
] satisfies RouteConfig;
