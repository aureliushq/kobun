import { collection, config, fields } from '@rescribe/core'

const rescribeConfig = config({
	// basePath: '/rescribe',
	collections: {
		posts: collection({
			label: 'Posts',
			slug: 'posts',
			paths: {
				assets: 'posts/**/*',
				content: 'posts/**/*',
			},
			schema: {
				title: fields.text({
					label: 'Title',
				}),
				content: fields.document({
					label: 'Content',
				}),
				description: fields.text({
					label: 'Excerpt',
					multiline: true,
				}),
				slug: fields.slug({
					label: 'Slug',
					title: {
						key: 'title',
					},
				}),
				published: fields.boolean({
					component: 'switch',
					label: 'Publish Page',
				}),
			},
		}),
		docs: collection({
			label: 'Docs',
			slug: 'docs',
			paths: {
				assets: 'docs/**/*',
				content: 'docs/**/*',
			},
			schema: {
				title: fields.text({
					label: 'Title',
					description: 'Page Title',
				}),
				content: fields.document({
					label: 'Content',
				}),
				published: fields.boolean({
					component: 'checkbox',
					label: 'Publish Page',
					description:
						'If the page should be published. Page will be saved as a draft by default.',
				}),
				slug: fields.slug({
					label: 'Slug',
					description: 'Slug of the post',
					title: {
						key: 'title',
					},
				}),
			},
		}),
	},
	storage: {
		mode: 'local',
		assets: 'assets',
		content: 'content',
		format: 'mdx',
	},
})

export default rescribeConfig
