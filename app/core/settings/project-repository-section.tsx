import { ExternalLinkIcon } from "lucide-react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"

export interface ProjectRepository {
	htmlUrl: string
	name: string
	owner: string
}

/**
 * The connection Kobun owns: which repository this Project points at, and the
 * way to change what the GitHub App can see (ADR-0010).
 *
 * Repository access is granted on GitHub and nowhere else, so this links out
 * rather than offering a control that would only link out anyway. Disconnect is
 * the other half of the connection and destroys Drafts, so it gets its own
 * ringed card at the foot of the page rather than a button in this one — see
 * `DisconnectProjectSection` (#137).
 */
export function ProjectRepositorySection({
	repository,
}: {
	repository: ProjectRepository
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Repository</CardTitle>
				<CardDescription>
					The repository this Project writes to. Which repositories Kobun can
					see is granted to the GitHub App — change it on{" "}
					<a
						className="inline-flex items-center gap-1 underline underline-offset-2"
						href="https://github.com/settings/installations"
						rel="noreferrer"
						target="_blank"
					>
						your GitHub App installation <ExternalLinkIcon className="size-3" />
					</a>
					.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<a
					className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
					href={repository.htmlUrl}
					rel="noreferrer"
					target="_blank"
				>
					{repository.owner}/{repository.name}
					<ExternalLinkIcon className="size-3" />
				</a>
			</CardContent>
		</Card>
	)
}
