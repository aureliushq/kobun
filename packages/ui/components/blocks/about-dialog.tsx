import {
	ArrowUpCircleIcon,
	ExternalLinkIcon,
	GithubIcon,
	GlobeIcon,
	RefreshCwIcon,
} from "lucide-react"
import { Suspense } from "react"
import { Await } from "react-router"

import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/ui/components/base/dialog"

/**
 * What the instance knows about itself without asking anyone: constants stamped
 * in at build time. Awaited, so the chrome that shows them never waits.
 */
export type VersionInfo = {
	currentVersion: string
	isHosted: boolean
	// Unset when VITE_KOBUN_HOME_URL is missing at build time
	homeUrl?: string
}

/**
 * What it takes a network round-trip to learn. Streamed, so nothing on the page
 * waits for it — and so an instance that cannot reach its manifest still paints.
 */
export type ReleaseInfo = {
	changelogUrl: string
	hasUpdate: boolean
	latestVersion: string
	releaseUrl: string
}

/**
 * The one shape release news is read through. `fallback={null}` rather than a
 * skeleton because "no update available" is the common resolved state, so a
 * placeholder would promise something that usually never arrives; and an
 * errorElement because a `null` one is falsy and rethrows to the route.
 */
export const AwaitRelease = ({
	children,
	releaseInfo,
}: {
	children: (release: ReleaseInfo) => React.ReactNode
	releaseInfo: Promise<ReleaseInfo>
}) => (
	<Suspense fallback={null}>
		<Await errorElement={<></>} resolve={releaseInfo}>
			{children}
		</Await>
	</Suspense>
)

const AboutDialog = ({
	open,
	onOpenChange,
	releaseInfo,
	versionInfo,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	releaseInfo: Promise<ReleaseInfo>
	versionInfo: VersionInfo
}) => {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>About Kobun</DialogTitle>
					<DialogDescription>
						An open-source, headless CMS for your codebase.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground text-xs">Version</span>
						<div className="flex items-center gap-2">
							<span className="font-mono text-xs">
								v{versionInfo.currentVersion}
							</span>
							<AwaitRelease releaseInfo={releaseInfo}>
								{(release) =>
									release.hasUpdate && (
										<Badge variant="secondary" className="text-[0.6rem]">
											v{release.latestVersion} available
										</Badge>
									)
								}
							</AwaitRelease>
						</div>
					</div>
					{versionInfo.homeUrl && (
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground text-xs">Homepage</span>
							<a
								className="inline-flex items-center gap-1 text-xs hover:underline"
								href={versionInfo.homeUrl}
								rel="noreferrer"
								target="_blank"
							>
								<GlobeIcon className="size-3" />
								kobun.io
								<ExternalLinkIcon className="size-3" />
							</a>
						</div>
					)}
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground text-xs">GitHub</span>
						<a
							className="inline-flex items-center gap-1 text-xs hover:underline"
							href="https://github.com/aureliushq/kobun"
							rel="noreferrer"
							target="_blank"
						>
							<GithubIcon className="size-3" />
							aureliushq/kobun
							<ExternalLinkIcon className="size-3" />
						</a>
					</div>
					<AwaitRelease releaseInfo={releaseInfo}>
						{(release) => (
							<>
								{release.changelogUrl && (
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground text-xs">
											Changelog
										</span>
										<a
											className="inline-flex items-center gap-1 text-xs hover:underline"
											href={release.changelogUrl}
											rel="noreferrer"
											target="_blank"
										>
											Release notes
											<ExternalLinkIcon className="size-3" />
										</a>
									</div>
								)}
								{release.hasUpdate && (
									<div className="mt-1 flex flex-col gap-2 rounded-md border p-3">
										<div className="flex items-center gap-2">
											<ArrowUpCircleIcon className="size-4 text-blue-500" />
											<span className="font-medium text-xs">
												Update available: v{release.latestVersion}
											</span>
										</div>
										{versionInfo.isHosted ? (
											<Button
												size="sm"
												variant="outline"
												className="w-full"
												onClick={() => window.location.reload()}
											>
												<RefreshCwIcon className="size-3" />
												Refresh to update
											</Button>
										) : (
											<Button
												size="sm"
												variant="outline"
												className="w-full"
												render={
													// biome-ignore lint/a11y/useAnchorContent: it's fine
													<a
														href={release.releaseUrl}
														rel="noreferrer"
														target="_blank"
													/>
												}
											>
												<ExternalLinkIcon className="size-3" />
												View release notes
											</Button>
										)}
									</div>
								)}
							</>
						)}
					</AwaitRelease>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default AboutDialog
