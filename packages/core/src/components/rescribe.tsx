import { type RescribeContextData, RescribeProvider } from '@/providers'

type RescribeProps = RescribeContextData

const Rescribe = ({ config }: RescribeProps) => {
	return (
		<RescribeProvider config={config}>
			<div>Hello, User!</div>
		</RescribeProvider>
	)
}

export default Rescribe
