import type { ReleaseInfo } from "@/ui/components/blocks/about-dialog"

/**
 * What the running instance can learn about its own releases. Every field has
 * an answer the moment the instance knows its own version, so a manifest that
 * cannot be read — unreachable, unauthenticated, or answering a login page —
 * costs the About dialog its update notice and nothing else.
 *
 * Kept apart from `VersionInfo`, which is build-time constants and needs no
 * network at all, so the dashboard chrome never waits on this to paint.
 */
export async function fetchReleaseInfo(
	appUrl: string | undefined,
	currentVersion: string,
): Promise<ReleaseInfo> {
	const noNews: ReleaseInfo = {
		changelogUrl: "",
		hasUpdate: false,
		latestVersion: currentVersion,
		releaseUrl: "",
	}

	// A self-hosted instance built without VITE_KOBUN_APP_URL has nowhere to ask.
	if (!appUrl) return noNews

	try {
		const response = await fetch(`${appUrl}/manifest.json`)
		if (!response.ok) return noNews

		const manifest = (await response.json()) as {
			changelogUrl: string
			releaseUrl: string
			version: string
		}
		return {
			changelogUrl: manifest.changelogUrl,
			hasUpdate: manifest.version !== currentVersion,
			latestVersion: manifest.version,
			releaseUrl: manifest.releaseUrl,
		}
	} catch {
		return noNews
	}
}
