import { Rescribe } from '@rescribe/core'
import rescribeConfig from '~/rescribe.config'
import '@rescribe/core/rescribe.css'

export function meta() {
	return [
		{ title: 'New React Router App' },
		{ name: 'description', content: 'Welcome to React Router!' },
	]
}

export default function Home() {
	return <Rescribe config={rescribeConfig} />
}
