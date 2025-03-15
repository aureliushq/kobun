import type { Config, ConfigSchema, SchemaKey } from '@kobun/common'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

export type ActionHandlerArgs = {
	config: Config
} & ActionFunctionArgs

export type LoaderHandlerArgs = {
	config: Config
} & LoaderFunctionArgs

export type AllParams = {
	filters?: Record<string, string>
}

export type UniqueArg = {
	where: {
		id?: string
		slug?: string
	}
	options?: {
		headings?: boolean
	}
}

export type UniqueReturn = {
	code: string
	content: string
	frontmatter: unknown
}

export type CollectionInterface<T extends SchemaKey> = {
	_label: string
	_schema: ConfigSchema<T>
	all: (params: AllParams) => Promise<unknown[]>
	unique: (arg: UniqueArg) => Promise<unknown>
}

export type SingletonInterface<T extends SchemaKey> = {
	_label: string
	_schema: ConfigSchema<T>
	get: () => Promise<unknown>
}

export type KobunReader<T extends SchemaKey> = {
	[key: string]: CollectionInterface<T> | SingletonInterface<T>
}
