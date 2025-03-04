import BooleanField from '~/components/form/fields/boolean'
import DateField from '~/components/form/fields/date'
import SelectField from '~/components/form/fields/select'
import SlugField from '~/components/form/fields/slug'
import TextField from '~/components/form/fields/text'
import UrlField from '~/components/form/fields/url'
import MultiSelectField from './form/fields/multiselect'

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
			<MultiSelectField
				description='Select tags'
				label='Tags'
				options={[
					{ label: 'Books', value: 'books' },
					{ label: 'Go', value: 'go' },
					{ label: 'JavaScript', value: 'javascript' },
					{ label: 'Odin', value: 'odin' },
					{ label: 'Opinion', value: 'opinion' },
					{ label: 'Rust', value: 'rust' },
					{ label: 'TypeScript', value: 'typescript' },
				]}
				placeholder='Select tags'
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
				htmlType='email'
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
