import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes"
import { BASE_PATH, ONBOARDING_PATH } from "@/ui/lib/constants"

export default [
	index("routes/login.tsx"),
	route("/api/auth/*", "routes/api.auth.$.ts"),
	route("/api/set-theme", "routes/api.set-theme.ts"),
	route("/component-examples", "routes/example.tsx"),
	route(ONBOARDING_PATH, "routes/onboarding.tsx"),
	layout("core/components/layouts/dashboard.tsx", [
		route(BASE_PATH, "routes/dashboard.tsx"),
	]),
] satisfies RouteConfig
