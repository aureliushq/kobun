import type { CoreConfig } from "@/core"

// export const userRoles = ["premium", "elite"] as const

export type Config = CoreConfig

const config: Config = {
	core: {
		supportEmail: "support@kobun.io",
		websiteUrl: "https://kobun.io",
		projectName: "Kobun CMS",
		darkMode: true,
		appTitle: "Kobun - A git-based CMS for content and static sites.",
	},
}

export default config
