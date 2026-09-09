import { useState } from "react"
import { useFetcher } from "react-router"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/ui/components/base/alert-dialog"
import { Button } from "@/ui/components/base/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import { Field, FieldLabel } from "@/ui/components/base/field"
import { Input } from "@/ui/components/base/input"
import { SettingsActionIntents } from "@/ui/lib/types"
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
	const fetcher = useFetcher()
	const [confirmation, setConfirmation] = useState("")
	const [open, setOpen] = useState(false)

	const slug = `${repository.owner}/${repository.name}`
	const confirmed = confirmation.trim().toLowerCase() === slug.toLowerCase()

	return (
		<Card className="ring-destructive/30">
			<CardHeader>
				<CardTitle className="text-destructive">Disconnect project</CardTitle>
				<CardDescription>
					Kobun forgets this repository and deletes the Drafts it was holding
					for it. The repository itself is not touched.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<AlertDialog
					onOpenChange={(next) => {
						setOpen(next)
						if (!next) setConfirmation("")
					}}
					open={open}
				>
					<AlertDialogTrigger render={<Button variant="destructive" />}>
						Disconnect project
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Disconnect {slug}?</AlertDialogTitle>
							<AlertDialogDescription>
								{dirtyDraftCount === 0
									? "No Draft holds work your repository does not have."
									: `${dirtyDraftCount} ${
											dirtyDraftCount === 1 ? "Draft holds" : "Drafts hold"
										} work your repository does not have, and disconnecting deletes ${
											dirtyDraftCount === 1 ? "it" : "them"
										} for good.`}{" "}
								Kobun also forgets the repository and drops the Collection
								listings it had cached. Files already committed to GitHub are
								not touched, and the Kobun GitHub App stays installed — so
								connecting this repository again is one step in setup. This
								cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<Field>
							<FieldLabel htmlFor="disconnect-project-confirmation">
								Type {slug} to confirm
							</FieldLabel>
							<Input
								autoComplete="off"
								id="disconnect-project-confirmation"
								onChange={(event) => setConfirmation(event.target.value)}
								value={confirmation}
							/>
						</Field>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								disabled={!confirmed || fetcher.state !== "idle"}
								onClick={() => {
									fetcher.submit(
										{
											confirmation,
											intent: SettingsActionIntents.DISCONNECT_PROJECT,
										},
										{ method: "post" },
									)
									setOpen(false)
								}}
								variant="destructive"
							>
								Disconnect project
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</CardContent>
		</Card>
	)
}
