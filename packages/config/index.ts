import type { CoreConfig } from "@/types/config"

// export const userRoles = ["premium", "elite"] as const

export type Config = CoreConfig

const config: Config = {
	core: {
		supportEmail: "support@kobun.io",
		websiteUrl: "https://kobun.io",
		projectName: "Kobun",
		darkMode: true,
		appTitle: "Kobun - Git-based CMS for content and static sites.",
	},
}

export default config

export * from "./types"
