import type { Dispatch, ReactNode, SetStateAction } from 'react'

import EditorHeader from '@/components/blocks/editor-header'
import { ScrollArea } from '@/components/ui/scroll-area'

const EditorLayout = ({
	children,
	setOpenCollectionSettings,
}: {
	children?: ReactNode | ReactNode[]
	setOpenCollectionSettings: Dispatch<SetStateAction<boolean>>
}) => {
	return (
		<main className='rs-w-screen rs-h-screen rs-flex rs-flex-col rs-gap-4'>
			<EditorHeader
				setOpenCollectionSettings={setOpenCollectionSettings}
			/>
			<ScrollArea className='rs-w-full rs-h-full rs-p-8 rs-z-10'>
				<section className='rs-w-full rs-flex rs-justify-center'>
					<div className='rs-w-full rs-max-w-5xl rs-flex rs-flex-col rs-gap-4'>
						{children}
					</div>
				</section>
			</ScrollArea>
		</main>
	)
}

export default EditorLayout
