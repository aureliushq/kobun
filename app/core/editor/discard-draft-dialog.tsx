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

/** The intent the dashboard's action deletes a Draft on. */
export const DISCARD_DRAFT_INTENT = "discard-draft"

/**
 * Asks before a Draft is deleted, then posts the discard. `action` names the
 * route that deletes it when that is not the page the dialog sits on.
 */
export function DiscardDraftDialog({
	action,
	draftId,
}: {
	action?: string
	draftId: string
}) {
	const fetcher = useFetcher()
	const [open, setOpen] = useState(false)

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button size="sm" variant="ghost" />}>
				Discard
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Discard this draft?</AlertDialogTitle>
					<AlertDialogDescription>
						This can&apos;t be undone. The draft and any changes the repository
						does not have will be permanently deleted.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={fetcher.state !== "idle"}
						onClick={() => {
							fetcher.submit(
								{ intent: DISCARD_DRAFT_INTENT, draftId },
								{ action, method: "post" },
							)
							setOpen(false)
						}}
					>
						Discard
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
