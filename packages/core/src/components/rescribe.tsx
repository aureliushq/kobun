import { type RescribeContextData, RescribeProvider } from '@/providers'
import BooleanField from './fields/boolean'
import DateField from './fields/date'
import SelectField from './fields/select'
import SlugField from './fields/slug'
import TextField from './fields/text'
import UrlField from './fields/url'
import { DashboardLayout } from './layouts'

type RescribeProps = RescribeContextData

const Rescribe = ({ config }: RescribeProps) => {
	return (
		<RescribeProvider config={config}>
			<DashboardLayout>
				<BooleanField
					component='checkbox'
					config={{ id: 'accept-terms-checkbox' }}
					defaultChecked={true}
					description='You agree to our Terms of Service and Privacy Policy.'
					label='Accept terms and conditions'
				/>
				<BooleanField
					component='switch'
					config={{ id: 'accept-terms-switch' }}
					defaultChecked={true}
					description='You agree to our Terms of Service and Privacy Policy.'
					label='Accept terms and conditions'
				/>
				<DateField
					description='Set the date when the article was published.'
					label='Published At'
				/>
				<SelectField
					description='Set if the series is ongoing or completed.'
					label='Status'
					options={[
						{ label: 'Ongoing', value: 'ongoing' },
						{ label: 'Completed', value: 'completed' },
					]}
					placeholder='Select Status'
				/>
				<TextField
					description='Your work email'
					label='Email'
					placeholder='anakin@not-a-jedi-master.com'
					type='email'
				/>
				<TextField
					description='Let us know if we can do better'
					label='Feedback'
					placeholder='Type your feedback message here'
					multiline={true}
				/>
				<UrlField
					description='The title of the post'
					label='Website'
					placeholder='https://not-a-jedi-master.com'
				/>
				<SlugField
					name={{
						description: 'The title of the post',
						label: 'Title',
						placeholder: 'Post Title',
					}}
					slug={{
						description: 'File/folder name for this post',
						label: 'Slug',
						placeholder: 'post-title',
					}}
				/>
			</DashboardLayout>
		</RescribeProvider>
	)
}

export default Rescribe
