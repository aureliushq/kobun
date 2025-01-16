import { type RescribeContextData, RescribeProvider } from '@/providers'

type RescribeProps = RescribeContextData

const Rescribe = ({ config }: RescribeProps) => {
	return (
		<RescribeProvider config={config}>
			<div>Rescribe</div>
		</RescribeProvider>
	)
}

export default Rescribe
