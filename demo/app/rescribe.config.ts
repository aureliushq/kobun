import { collection, config, fields } from '@rescribe/core'

const rescribeConfig = config({
	collections: {
		articles: collection({
			label: 'Articles',
			slug: 'articles',
			paths: {
				assets: 'articles/**/*',
				content: 'articles/**/*',
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
				publishedAt: fields.date({
					label: 'Publish Date',
					description: 'Set the publish date of the page',
				}),
				slug: fields.slug({
					name: {
						label: 'Post Title',
						description: 'Title of the post',
					},
					slug: {
						label: 'Slug',
						description: 'Slug of the post',
					},
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
				publishedAt: fields.date({
					label: 'Publish Date',
					description: 'Set the publish date of the page',
				}),
				slug: fields.slug({
					name: {
						label: 'Post Title',
						description: 'Title of the post',
					},
					slug: {
						label: 'Slug',
						description: 'Slug of the post',
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
