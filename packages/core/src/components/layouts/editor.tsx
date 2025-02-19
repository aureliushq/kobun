import type { ReactNode } from 'react'

import EditorHeader from '@/components/blocks/editor-header'
import type { Labels } from '@/components/rescribe'
import { ScrollArea } from '@/components/ui/scroll-area'

const EditorLayout = ({
	children,
	labels,
}: { children?: ReactNode | ReactNode[]; labels: Labels | undefined }) => {
	return (
		<main className='rs-w-screen rs-h-screen rs-flex rs-flex-col rs-gap-4'>
			<EditorHeader labels={labels} />
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
