import type { Config } from '@kobun/common'
import { useContext } from 'react'
import invariant from 'tiny-invariant'

import Collection from '~/components/blocks/collection'
import DashboardLayout from '~/components/layouts/dashboard'
import EditorLayout from '~/components/layouts/editor'
import ComponentReference from '~/components/reference'
import { TooltipProvider } from '~/components/ui/tooltip'
import { generateLabelsForCollection } from '~/lib/utils'
import {
	KobunContext,
	type KobunContextData,
	KobunProvider,
	ThemeProvider,
} from '~/providers'

export type Labels = {
	plural: string
	singular: string
}

const Root = () => {
	const { config, params } = useContext<KobunContextData>(KobunContext)

	let labels: Labels | undefined
	if (
		params?.section === 'collections' ||
		params?.section === 'editor-create' ||
		params?.section === 'editor-edit'
	) {
		const collectionSlug = params.collectionSlug
		labels = generateLabelsForCollection(config as Config, collectionSlug)
	}

	if (params?.section === 'collections') {
		const collectionSlug = params.collectionSlug
		return (
			<DashboardLayout>
				<Collection collectionSlug={collectionSlug} labels={labels} />
			</DashboardLayout>
		)
	}

	if (
		params?.section === 'editor-create' ||
		params?.section === 'editor-edit'
	) {
		const collectionSlug = params.collectionSlug
		return (
			<TooltipProvider>
				<EditorLayout collectionSlug={collectionSlug} labels={labels} />
			</TooltipProvider>
		)
	}

	if (params?.section === 'root') {
		return (
			<DashboardLayout>
				<ComponentReference />
			</DashboardLayout>
		)
	}

	if (params?.section === 'settings') {
		return <DashboardLayout>Settings</DashboardLayout>
	}

	return <div>Not Found. Check the URL and make sure there are no typos.</div>
}

type KobunProps = KobunContextData

const Kobun = ({ config }: KobunProps) => {
	invariant(
		config,
		'`config` is required for the Kobun component. Check the docs to see how to write the configuration.',
	)

	return (
		<ThemeProvider defaultTheme='dark' storageKey='kobun-theme'>
			<KobunProvider config={config}>
				<Root />
			</KobunProvider>
		</ThemeProvider>
	)
}

export default Kobun
