import { LinkIcon, UnlinkIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { Form } from 'react-router'

import { Button } from '~/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'

type LinkDialogProps = {
	defaultValue?: string
	handleSetLink: (link: string) => void
	onOpenChange: (open: boolean) => void
	open: boolean
}

const LinkDialog = ({
	defaultValue,
	handleSetLink,
	onOpenChange,
	open,
}: LinkDialogProps) => {
	const handleLinkSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()

		const formData = new FormData(e.currentTarget)
		const link = formData.get('link') as string
		const intent = formData.get('intent') as string

		if (intent === 'set') {
			handleSetLink(link)
		} else {
			handleSetLink('')
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className='sm:rs-max-w-[480px]'>
				<DialogHeader>
					<DialogTitle>Insert Link</DialogTitle>
				</DialogHeader>
				<Form
					className='rs-w-full rs-flex rs-items-center rs-gap-2'
					onSubmit={handleLinkSubmit}
				>
					<div className='rs-w-full'>
						<Input
							defaultValue={defaultValue}
							id='link'
							name='link'
							placeholder='https://karasunohigh.co.jp/clubs/volleyball'
						/>
					</div>
					{defaultValue ? (
						<>
							<Input name='intent' type='hidden' value='unset' />
							<Button size='icon' type='submit'>
								<UnlinkIcon className='rs-w-4 rs-h-4' />
							</Button>
						</>
					) : (
						<>
							<Input name='intent' type='hidden' value='set' />
							<Button size='icon' type='submit'>
								<LinkIcon className='rs-w-4 rs-h-4' />
							</Button>
						</>
					)}
				</Form>
			</DialogContent>
		</Dialog>
	)
}

export default LinkDialog
