import { SettingsActionIntents } from "@/ui/lib/types"
import { DangerConfirmCard } from "./danger-confirm-card"
import type { ProjectRepository } from "./project-repository-section"

/**
 * Disconnecting a Project, with the repository's own name as the lock.
 *
 * The danger here is Drafts, and it is the only danger — so the dialog leads
 * with how many of them are Dirty rather than burying the number in a
 * paragraph. A Dirty Draft holds work the Source does not have, nothing else in
 * Kobun destroys writing in bulk, and a writer who has none is owed that answer
 * just as plainly as one who has nine.
 *
 * `owner/name` is the phrase worth asking for: it is rendered a few inches
 * above in the Repository section, and nobody types another account's
 * repository by accident. The action checks it again — this is a guard rail on
 * the way to a decision, not the decision itself, the same way
 * `DeleteAccountSection` treats the email it asks for.
 *
 * The rest of the description is there because the surprises point in opposite
 * directions: a writer who did not realise their Drafts were Kobun's to lose,
 * and a writer who expected this to take the repository or the GitHub App with
 * it. It takes neither, which is what makes reconnecting one step in setup.
 */
export function DisconnectProjectSection({
	dirtyDraftCount,
	repository,
}: {
	dirtyDraftCount: number
	repository: ProjectRepository
}) {
	const slug = `${repository.owner}/${repository.name}`

	return (
		<DangerConfirmCard
			confirmLabel="Disconnect project"
			description="Kobun forgets this repository and deletes the Drafts it was holding for it. The repository itself is not touched."
			dialogTitle={`Disconnect ${slug}?`}
			intent={SettingsActionIntents.DISCONNECT_PROJECT}
			phrase={slug}
			title="Disconnect project"
		>
			{dirtyDraftCount === 0
				? "No Draft holds work your repository does not have."
				: `${dirtyDraftCount} ${
						dirtyDraftCount === 1 ? "Draft holds" : "Drafts hold"
					} work your repository does not have, and disconnecting deletes ${
						dirtyDraftCount === 1 ? "it" : "them"
					} for good.`}{" "}
			Kobun also forgets the repository and drops the Collection listings it had
			cached. Files already committed to GitHub are not touched, and the Kobun
			GitHub App stays installed — so connecting this repository again is one
			step in setup. This cannot be undone.
		</DangerConfirmCard>
	)
}
