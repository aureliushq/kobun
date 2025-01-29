import type { ReactNode } from 'react'

import EditorHeader from '@/components/layouts/blocks/editor-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Labels } from '@/components/rescribe'

const EditorLayout = ({
	children,
	labels,
}: { children?: ReactNode | ReactNode[]; labels: Labels | undefined }) => {
	return (
		<main className='w-screen h-screen flex flex-col gap-4'>
			<EditorHeader labels={labels} />
			<ScrollArea className='w-full h-full p-8'>
				<section className='w-full flex justify-center'>
					<div className='w-full max-w-5xl flex flex-col gap-4'>
						{children}
					</div>
				</section>
			</ScrollArea>
		</main>
	)
}

export default EditorLayout
