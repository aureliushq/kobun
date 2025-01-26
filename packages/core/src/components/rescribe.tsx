import { useContext } from 'react'
import { useLoaderData } from 'react-router'
import invariant from 'tiny-invariant'

import Collection from '@/components/layouts/collection'
import { DashboardLayout } from '@/components/layouts/dashboard'
import ComponentReference from '@/components/reference'
import {
	RescribeContext,
	type RescribeContextData,
	RescribeProvider,
} from '@/providers'

const Root = () => {
	const { params } = useContext<RescribeContextData>(RescribeContext)

	if (params?.collection && !params.action) {
		return (
			<DashboardLayout>
				<Collection />
			</DashboardLayout>
		)
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
