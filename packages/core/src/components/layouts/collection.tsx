import { FileTextIcon, FilesIcon, LinkIcon } from 'lucide-react'
import { useContext } from 'react'

import { EmptyState } from '@/components/ui/empty-state'
import { RescribeContext, type RescribeContextData } from '@/providers'

const Collection = () => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)

	const collection = params?.collection
	const collectionLabel = collection
		? config?.collections[collection].label
		: 'Content'

	return (
		<EmptyState
			className='w-full max-w-none'
			title={`No ${collectionLabel} Yet`}
			description=''
			icons={[FileTextIcon, LinkIcon, FilesIcon]}
			action={{
				label: 'Add Content',
				onClick: () => console.log('Create form clicked'),
			}}
		/>
	)
}

export default Collection
