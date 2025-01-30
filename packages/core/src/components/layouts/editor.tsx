import type { ReactNode } from 'react'

import EditorHeader from '@/components/blocks/editor-header'
import type { Labels } from '@/components/rescribe'
import { ScrollArea } from '@/components/ui/scroll-area'

const EditorLayout = ({
	children,
	labels,
}: { children?: ReactNode | ReactNode[]; labels: Labels | undefined }) => {
	return (
		<main className='w-screen h-screen flex flex-col gap-4'>
			<EditorHeader labels={labels} />
			<ScrollArea className='w-full h-full p-8 z-10'>
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
