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

/**
 * Deleting an account, with the writer's own email address as the lock.
 *
 * Typing something is what separates this from every other button on the page,
 * and the email is the phrase worth asking for: it is the one on the row about
 * to be deleted, it is written a few inches above in the Profile section, and
 * nobody types their own address by accident. The action checks it again — this
 * is a guard rail on the way to a decision, not the decision itself.
 *
 * The description names everything that goes and everything that stays, because
 * the surprises here point in opposite directions: a writer who did not realise
 * their Drafts were Kobun's to lose, and a writer who assumed deleting the
 * account also removed the GitHub App and their mailing-list entry. It does
 * neither — the App is theirs to remove on GitHub, and taking the contact off
 * the list with the account is #147.
 */
export function DeleteAccountSection({ email }: { email: string }) {
	const fetcher = useFetcher()
	const [confirmation, setConfirmation] = useState("")
	const [open, setOpen] = useState(false)

	const confirmed = confirmation.trim().toLowerCase() === email.toLowerCase()

	return (
		<Card className="ring-destructive/30">
			<CardHeader>
				<CardTitle className="text-destructive">Delete account</CardTitle>
				<CardDescription>
					Erase your Kobun account, your Projects and your Drafts. Your
					repositories are not touched.
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
						Delete my account
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete your account?</AlertDialogTitle>
							<AlertDialogDescription>
								This deletes your Kobun account, every Project you have
								connected, every Draft Kobun is holding for you, your cached
								Collection listings, your Preferences and all your sessions.
								Files already committed to your GitHub repositories are not
								touched, and your email address stays on Kobun&apos;s mailing
								list — use the unsubscribe link in any Kobun email to come off
								it. The Kobun GitHub App stays installed — remove it yourself
								from{" "}
								<a
									className="underline underline-offset-2"
									href="https://github.com/settings/installations"
									rel="noreferrer"
									target="_blank"
								>
									your GitHub installations
								</a>
								. This cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<Field>
							<FieldLabel htmlFor="delete-account-confirmation">
								Type {email} to confirm
							</FieldLabel>
							<Input
								autoComplete="off"
								id="delete-account-confirmation"
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
											intent: SettingsActionIntents.DELETE_ACCOUNT,
										},
										{ method: "post" },
									)
									setOpen(false)
								}}
								variant="destructive"
							>
								Delete my account
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</CardContent>
		</Card>
	)
}
