import { collection, config, fields } from '@rescribe/core'

const rescribeConfig = config({
	collections: {
		docs: collection({
			format: 'mdx',
			label: 'Docs',
			slug: 'docs',
			path: 'content/docs/**/*',
			schema: {
				title: fields.text({
					label: 'Title',
					description: 'Page Title',
				}),
				content: fields.document({
					label: 'Content',
				}),
				published: fields.boolean({
					label: 'Publish Page',
					description:
						'If the page should be published. Page will be saved as a draft by default.',
				}),
				publishedAt: fields.date({
					label: 'Publish Date',
					description: 'Set the publish date of the page',
				}),
				slug: fields.slug({
					label: 'Page URL',
					description: 'URL of the page',
				}),
			},
		}),
	},
})

export default rescribeConfig
