import { collection, config, fields } from '@rescribejs/core'

const rescribeConfig = config({
	basePath: '/rescribe',
	collections: {
		articles: collection({
			features: {
				publish: true,
			},
			label: 'Articles',
			paths: {
				assets: 'articles/**/*',
				content: 'articles/**/*',
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
				excerpt: fields.text({
					label: 'Excerpt',
					multiline: true,
				}),
			},
		}),
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
