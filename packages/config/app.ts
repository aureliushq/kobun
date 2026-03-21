import type { AppConfig } from "@/types/config"

// export const userRoles = ["premium", "elite"] as const

const config: AppConfig = {
	core: {
		supportEmail: "support@kobun.io",
		websiteUrl: "https://kobun.io",
		projectName: "Kobun",
		darkMode: true,
		appTitle: "Kobun - Git-based CMS for content and static sites.",
	},
}

export default config
