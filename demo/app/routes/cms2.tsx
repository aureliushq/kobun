import { Rescribe } from '@rescribe/rr7'
import rescribeConfig from '~/rescribe.config'
import '@rescribe/rr7/rescribe.css'

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
