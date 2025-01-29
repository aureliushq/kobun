import { useContext } from 'react'
import { useLoaderData } from 'react-router'
import invariant from 'tiny-invariant'

import Collection from '@/components/layouts/blocks/collection'
import DashboardLayout from '@/components/layouts/dashboard'
import EditorLayout from '@/components/layouts/editor'
import ComponentReference from '@/components/reference'
import {
	RescribeContext,
	type RescribeContextData,
	RescribeProvider,
} from '@/providers'
import { generateLabelsForCollection } from '@/lib/utils'
import type { Config } from '@/types'

export type Labels = {
	plural: string
	singular: string
}

const Root = () => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)

	let labels: Labels | undefined
	if (params?.section === 'collections' || params?.section === 'editor') {
		const collection = params?.collection as string
		labels = generateLabelsForCollection(config as Config, collection)
	}

	if (params?.section === 'collections' && params.action === 'list') {
		return (
			<DashboardLayout>
				<Collection labels={labels} />
			</DashboardLayout>
		)
	}

	if (params?.section === 'editor') {
		return <EditorLayout labels={labels}>Editor</EditorLayout>
	}

	if (params?.section === 'settings') {
		return <DashboardLayout>Settings</DashboardLayout>
	}

	if (params?.root) {
		return (
			<DashboardLayout>
				<ComponentReference />
			</DashboardLayout>
		)
	}

	return <div>Not Found. Check the URL and make sure there are no typos.</div>
}

type RescribeProps = RescribeContextData

const Rescribe = ({ config }: RescribeProps) => {
	invariant(
		config,
		'`config` is required for the Rescribe component. Check the docs to see how to write the configuration.',
	)

	const data = useLoaderData()

	return (
		<RescribeProvider config={config}>
			<Root />
		</RescribeProvider>
	)
}

export default Rescribe
