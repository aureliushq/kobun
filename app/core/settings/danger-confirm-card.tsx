import { type ReactNode, useId, useState } from "react"
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
import type { SettingsActionIntents } from "@/ui/lib/types"

/**
 * A destructive settings action behind a type-to-confirm dialog.
 *
 * The confirm button stays disabled until the writer types `phrase` (trimmed,
 * any case), and closing the dialog forgets what was typed. The typed text is
 * submitted with `intent` so the action can check it again.
 */
export function DangerConfirmCard({
	children,
	confirmLabel,
	description,
	dialogTitle,
	intent,
	phrase,
	title,
}: {
	children: ReactNode
	confirmLabel: string
	description: string
	dialogTitle: string
	intent: SettingsActionIntents
	phrase: string
	title: string
}) {
	const fetcher = useFetcher()
	const inputId = useId()
	const [confirmation, setConfirmation] = useState("")
	const [open, setOpen] = useState(false)

	const confirmed = confirmation.trim().toLowerCase() === phrase.toLowerCase()

	return (
		<Card className="ring-destructive/30">
			<CardHeader>
				<CardTitle className="text-destructive">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
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
						{confirmLabel}
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
							<AlertDialogDescription>{children}</AlertDialogDescription>
						</AlertDialogHeader>
						<Field>
							<FieldLabel htmlFor={inputId}>
								Type {phrase} to confirm
							</FieldLabel>
							<Input
								autoComplete="off"
								id={inputId}
								onChange={(event) => setConfirmation(event.target.value)}
								value={confirmation}
							/>
						</Field>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								disabled={!confirmed || fetcher.state !== "idle"}
								onClick={() => {
									fetcher.submit({ confirmation, intent }, { method: "post" })
									setOpen(false)
								}}
								variant="destructive"
							>
								{confirmLabel}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</CardContent>
		</Card>
	)
}
