import { collection, config, fields } from '@rescribe/core'

const rescribeConfig = config({
	basePath: '/rescribe',
	collections: {
		docs: collection({
			features: {
				publish: true,
			},
			label: 'Docs',
			paths: {
				assets: 'docs/**/*',
				content: 'docs/**/*',
			},
			schema: {
				title: fields.text({
					label: 'Title',
				}),
				content: fields.document({
					label: 'Content',
				}),
				slug: fields.slug({
					label: 'Slug',
					title: {
						key: 'title',
					},
				}),
			},
			slug: 'docs',
		}),
		posts: collection({
			features: {
				publish: true,
			},
			label: 'Posts',
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
				slug: fields.slug({
					label: 'Slug',
					title: {
						key: 'title',
					},
				}),
				description: fields.text({
					label: 'Excerpt',
					multiline: true,
				}),
			},
			slug: 'posts',
		}),
		series: collection({
			features: {
				publish: true,
			},
			label: 'Series',
			paths: {
				assets: 'series/**/*',
				content: 'series/**/*',
			},
			schema: {
				title: fields.text({
					label: 'Title',
				}),
				description: fields.text({
					label: 'Description',
					multiline: true,
				}),
				slug: fields.slug({
					label: 'Slug',
					title: {
						key: 'title',
					},
				}),
			},
			slug: 'series',
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
