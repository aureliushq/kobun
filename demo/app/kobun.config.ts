import { collection, config, fields, singleton } from '@kobun/core'

const AUTHOR_OPTIONS = [{ label: 'James Holden', value: 'james-holden' }]

const TAG_OPTIONS = [
	{ label: 'side-projects', value: 'side-projects' },
	{ label: 'workflow', value: 'workflow' },
	{ label: 'productivity', value: 'productivity' },
	{ label: 'learning', value: 'learning' },
	{ label: 'local-first', value: 'local-first' },
	{ label: 'opinion', value: 'opinion' },
	{ label: 'typescript', value: 'typescript' },
	{ label: 'remix', value: 'remix' },
	{ label: 'react', value: 'react' },
	{
		label: 'golang',
		value: 'golang',
	},
	{
		label: 'rust',
		value: 'rust',
	},
	{ label: 'books', value: 'books' },
	{ label: 'journal', value: 'journal' },
	{ label: 'open-source', value: 'open-source' },
]

const kobunConfig = config({
	basePath: '/kobun',
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
				author: fields.select({
					label: 'Author',
					options: AUTHOR_OPTIONS,
				}),
				tags: fields.multiselect({
					label: 'Tags',
					options: TAG_OPTIONS,
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
				author: fields.select({
					label: 'Author',
					options: AUTHOR_OPTIONS,
				}),
				tags: fields.multiselect({
					label: 'Tags',
					options: TAG_OPTIONS,
				}),
			},
		}),
	},
	singletons: {
		home: singleton({
			label: 'Home Page',
			paths: {
				content: 'home/**/*',
			},
			schema: {
				title: fields.text({
					label: 'Site Title',
				}),
				description: fields.text({
					label: 'Site Description',
					multiline: true,
				}),
				author: fields.select({
					label: 'Default Author',
					options: AUTHOR_OPTIONS,
				}),
				socialLinks: fields.document({
					label: 'Social Links',
				}),
			},
		}),
	},
	storage: {
		format: {
			collections: 'mdx',
			singletons: 'json',
		},
		mode: 'r2',
	},
})

export default kobunConfig
