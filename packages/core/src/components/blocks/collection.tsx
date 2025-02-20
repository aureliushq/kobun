import { CircleX, FileTextIcon } from 'lucide-react'
import { useContext, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import invariant from 'tiny-invariant'

import type { Labels } from '~/components/rescribe'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/ui/empty-state'
import { Input } from '~/components/ui/input'
import { PATHS } from '~/lib/constants'
import { RescribeContext, type RescribeContextData } from '~/providers'
import type { Collection as CollectionType } from '~/types'

const CollectionHeader = ({
	basePath,
	collection,
	labels,
}: {
	basePath: string
	collection: CollectionType
	labels: Labels | undefined
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
		<section className='rs-w-full rs-h-12 rs-flex rs-items-center rs-justify-between'>
			<h3 className='rs-text-xl rs-font-semibold'>{collection.label}</h3>
			<div className='rs-flex rs-items-center rs-gap-2'>
				<div className='rs-space-y-2 rs-min-w-[300px]'>
					<div className='rs-relative'>
						<Input
							id={id}
							ref={inputRef}
							className='rs-h-9 rs-pe-9'
							placeholder={`Search ${labels?.plural.toLowerCase()}...`}
							type='text'
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
						/>
						{inputValue && (
							<button
								aria-label='Clear input'
								className='rs-absolute rs-inset-y-0 rs-end-0 rs-flex rs-h-full rs-w-9 rs-items-center rs-justify-center rs-rounded-e-lg rs-text-muted-foreground/80 rs-outline-offset-2 rs-transition-colors hover:rs-text-foreground focus:rs-z-10 focus-visible:rs-outline focus-visible:rs-outline-2 focus-visible:rs-outline-ring/70 disabled:rs-pointer-events-none disabled:rs-cursor-not-allowed disabled:rs-opacity-50'
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
				<Link to={`${basePath}/${PATHS.EDITOR}/${collection.slug}`}>
					<Button size='sm'>{`New ${labels?.singular}`}</Button>
				</Link>
			</div>
		</section>
	)
}

const Collection = ({
	labels,
}: {
	labels: Labels | undefined
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

	const basePath = config.basePath ?? ''
	const collection = config.collections[params.collection]

	return (
		<>
			<CollectionHeader
				basePath={basePath}
				collection={collection}
				labels={labels}
			/>
			<EmptyState
				className='rs-w-full rs-max-w-none rs-flex rs-flex-col rs-gap-2'
				title={`No ${labels?.plural.toLowerCase()} yet`}
				description={`It looks like there's nothing here yet! Get started by creating your first ${labels?.singular.toLowerCase()}.`}
				icons={[FileTextIcon, FileTextIcon, FileTextIcon]}
				action={
					<Link to={`${basePath}/${PATHS.EDITOR}/${collection.slug}`}>
						<Button
							className=''
							size='sm'
						>{`Write a new ${labels?.singular.toLowerCase()}`}</Button>
					</Link>
				}
			/>
		</>
	)
}

export default Collection
