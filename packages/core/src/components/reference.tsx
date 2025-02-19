import BooleanField from './form/fields/boolean'
import DateField from './form/fields/date'
import SelectField from './form/fields/select'
import SlugField from './form/fields/slug'
import TextField from './form/fields/text'
import UrlField from './form/fields/url'

const ComponentReference = () => {
	return (
		<>
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
				description='File/folder name for this post'
				label='Slug'
				placeholder='post-title'
			/>
		</>
	)
}

export default ComponentReference
