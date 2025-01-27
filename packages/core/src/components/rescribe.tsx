import { useContext } from 'react'
import { useLoaderData } from 'react-router'
import pluralize from 'pluralize-esm'
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
	const { config, params } = useContext<RescribeContextData>(RescribeContext)

	if (params?.collection && !params.action) {
		const collection = params?.collection
		const labels = pluralize.isPlural(
			config?.collections[collection].label as string,
		)
			? {
					plural: config?.collections[collection].label as string,
					singular: pluralize.singular(
						config?.collections[collection].label as string,
					) as string,
				}
			: {
					plural: pluralize(
						config?.collections[collection].label as string,
					) as string,
					singular: config?.collections[collection].label as string,
				}

		return (
			<DashboardLayout>
				<Collection labels={labels} />
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
