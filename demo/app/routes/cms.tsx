import { Rescribe } from '@rescribe/core'
import rescribeConfig from '~/rescribe.config'
import '@rescribe/core/rescribe.css'

export function meta() {
	return [
		{ title: 'New React Router App' },
		{ name: 'description', content: 'Welcome to React Router!' },
	]
}

export const loader = async () => {
	return { message: 'Hello from the server!' }
}

const CMS = () => {
	return <Rescribe config={rescribeConfig} />
}

export default CMS
