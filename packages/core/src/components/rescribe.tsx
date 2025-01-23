import { type RescribeContextData, RescribeProvider } from '@/providers'
import { DashboardLayout } from './layouts/dashboard'
import ComponentReference from './reference'
import { useLoaderData, useLocation } from 'react-router'
import invariant from 'tiny-invariant'
import { useMemo } from 'react'
import { parseAdminPathname } from '@/lib/utils'

type RescribeProps = RescribeContextData

const Rescribe = ({ config }: RescribeProps) => {
	invariant(
		config,
		'`config` is required for the Rescribe component. Check the docs to see how to write the configuration.',
	)

	const data = useLoaderData()
	const location = useLocation()
	const params = useMemo(() => {
		return parseAdminPathname({
			collections: config.collections,
			pathname: location.pathname,
		})
	}, [config, location.pathname])

	console.log(data)
	console.log(params)

	let component = null
	if (params?.collection && !params.action) {
		component = (
			<DashboardLayout>
				<div>{params.collection}</div>
			</DashboardLayout>
		)
	} else if (params?.root) {
		component = (
			<DashboardLayout>
				<ComponentReference />
			</DashboardLayout>
		)
	} else {
		component = (
			<div>
				Not Found. Check the URL and make sure there are no typos.
			</div>
		)
	}

	return <RescribeProvider config={config}>{component}</RescribeProvider>
}

export default Rescribe
