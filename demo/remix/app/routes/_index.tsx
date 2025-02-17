import type { MetaFunction } from '@remix-run/node'
import { Rescribe } from '@rescribe/core'
import rescribeConfig from '~/rescribe.config'

export const meta: MetaFunction = () => {
	return [
		{ title: 'New Remix App' },
		{ name: 'description', content: 'Welcome to Remix!' },
	]
}

export default function Index() {
	return <Rescribe config={rescribeConfig} />
}
