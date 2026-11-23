import { SettingsActionIntents } from "@/ui/lib/types"
import { DangerConfirmCard } from "./danger-confirm-card"

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
	return (
		<DangerConfirmCard
			confirmLabel="Delete my account"
			description="Erase your Kobun account, your Projects and your Drafts. Your repositories are not touched."
			dialogTitle="Delete your account?"
			intent={SettingsActionIntents.DELETE_ACCOUNT}
			phrase={email}
			title="Delete account"
		>
			This deletes your Kobun account, every Project you have connected, every
			Draft Kobun is holding for you, your cached Collection listings, your
			Preferences and all your sessions. Files already committed to your GitHub
			repositories are not touched, and your email address stays on Kobun&apos;s
			mailing list — use the unsubscribe link in any Kobun email to come off it.
			The Kobun GitHub App stays installed — remove it yourself from{" "}
			<a
				className="underline underline-offset-2"
				href="https://github.com/settings/installations"
				rel="noreferrer"
				target="_blank"
			>
				your GitHub installations
			</a>
			. This cannot be undone.
		</DangerConfirmCard>
	)
}
