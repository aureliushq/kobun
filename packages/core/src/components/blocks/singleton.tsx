import { useForm } from '@conform-to/react'
import type { SchemaKey } from '@kobun/common'
import { useContext } from 'react'
import { Form as RRForm, useActionData, useLoaderData } from 'react-router'
import invariant from 'tiny-invariant'

import Form from '~/components/form'
import { KobunContext, type KobunContextData } from '~/providers'
import { Button } from '../ui/button'

const Singleton = ({ singletonSlug }: { singletonSlug: string }) => {
	const lastResult = useActionData()
	const { config } = useContext<KobunContextData>(KobunContext)
	invariant(
		config?.singletons?.[singletonSlug],
		'Singleton not found in config',
	)
	const singleton = config.singletons[singletonSlug]

	const { item: defaultValue } = useLoaderData()

	const [form, fields] = useForm({
		defaultValue,
		lastResult,
	})

	// For singletons, all fields are treated as configuration fields
	const inputFields = Object.keys(singleton.schema).filter(
		(key: SchemaKey) =>
			key !== 'createdAt' && key !== 'publishedAt' && key !== 'updatedAt',
	)

	return (
		<RRForm id={form.id} method='post' onSubmit={form.onSubmit}>
			<header className='rs-w-full rs-max-w-4xl rs-mx-auto rs-h-16 rs-px-8 rs-flex rs-items-center rs-justify-between'>
				<h1 className='rs-text-xl rs-font-semibold'>
					{singleton.label}
				</h1>
				<Button size='sm' type='submit'>
					Save
				</Button>
			</header>
			<Form
				fields={fields}
				isContentFieldAvailable={false}
				layout='form'
				primaryInputFields={[]}
				schema={singleton.schema}
				secondaryInputFields={inputFields}
			/>
		</RRForm>
	)
}

export default Singleton
