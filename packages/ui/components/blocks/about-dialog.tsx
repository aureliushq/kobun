import {
	ArrowUpCircleIcon,
	ExternalLinkIcon,
	GithubIcon,
	GlobeIcon,
	RefreshCwIcon,
} from "lucide-react"

import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/ui/components/base/dialog"

export type VersionInfo = {
	currentVersion: string
	latestVersion: string
	hasUpdate: boolean
	isHosted: boolean
	releaseUrl: string
	changelogUrl: string
	homeUrl: string
}

const AboutDialog = ({
	open,
	onOpenChange,
	versionInfo,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
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
							{versionInfo.hasUpdate && (
								<Badge variant="secondary" className="text-[0.6rem]">
									v{versionInfo.latestVersion} available
								</Badge>
							)}
						</div>
					</div>
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
					{versionInfo.changelogUrl && (
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground text-xs">Changelog</span>
							<a
								className="inline-flex items-center gap-1 text-xs hover:underline"
								href={versionInfo.changelogUrl}
								rel="noreferrer"
								target="_blank"
							>
								Release notes
								<ExternalLinkIcon className="size-3" />
							</a>
						</div>
					)}
					{versionInfo.hasUpdate && (
						<div className="mt-1 flex flex-col gap-2 rounded-md border p-3">
							<div className="flex items-center gap-2">
								<ArrowUpCircleIcon className="size-4 text-blue-500" />
								<span className="font-medium text-xs">
									Update available: v{versionInfo.latestVersion}
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
											href={versionInfo.releaseUrl}
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
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default AboutDialog
