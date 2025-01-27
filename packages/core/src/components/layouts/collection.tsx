import { CircleX, FileTextIcon } from 'lucide-react'
import { useContext, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import invariant from 'tiny-invariant'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PATHS } from '@/lib/constants'
import { RescribeContext, type RescribeContextData } from '@/providers'
import type { Collection as CollectionType } from '@/types'

const CollectionHeader = ({
	collection,
	labels,
}: {
	collection: CollectionType

	labels: { plural: string; singular: string }
}) => {
	const id = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const [inputValue, setInputValue] = useState('')

	const handleClearInput = () => {
		setInputValue('')
		if (inputRef.current) {
			inputRef.current.focus()
		}
	}

	return (
		<section className='w-full h-12 flex items-center justify-between'>
			<h3 className='text-xl font-semibold'>{collection.label}</h3>
			<div className='flex items-center gap-2'>
				<div className='space-y-2 min-w-[300px]'>
					<div className='relative'>
						<Input
							id={id}
							ref={inputRef}
							className='h-9 pe-9'
							placeholder={`Search ${labels.plural.toLowerCase()}...`}
							type='text'
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
						/>
						{inputValue && (
							<button
								aria-label='Clear input'
								className='absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-lg text-muted-foreground/80 outline-offset-2 transition-colors hover:text-foreground focus:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'
								onClick={handleClearInput}
								type='button'
							>
								<CircleX
									size={16}
									strokeWidth={2}
									aria-hidden='true'
								/>
							</button>
						)}
					</div>
				</div>
				<Link to={`${PATHS.COLLECTIONS}/${collection.slug}/new`}>
					<Button size='sm'>{`New ${labels.singular}`}</Button>
				</Link>
			</div>
		</section>
	)
}

const Collection = ({
	labels,
}: {
	labels: { plural: string; singular: string }
}) => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	invariant(
		config,
		'`config` is required for the Rescribe component. Check the docs to see how to write the configuration.',
	)
	invariant(
		params?.collection,
		'Cannot read collection details. Check your URL.',
	)

	const collection = config.collections[params.collection]

	return (
		<>
			<CollectionHeader collection={collection} labels={labels} />
			<EmptyState
				className='w-full max-w-none flex flex-col gap-2'
				title={`No ${labels.plural.toLowerCase()} yet`}
				description={`Start building your collection by creating your first ${labels.singular.toLowerCase()}.`}
				icons={[FileTextIcon, FileTextIcon, FileTextIcon]}
				action={
					<Link to={`${PATHS.COLLECTIONS}/${collection.slug}/new`}>
						<Button
							className=''
							size='sm'
						>{`Write a new ${labels.singular.toLowerCase()}`}</Button>
					</Link>
				}
			/>
		</>
	)
}

export default Collection
