import type { Config, ConfigSchema, SchemaKey } from '@kobun/common'
import type {
	CollectionItemMetadata,
	SingletonMetadata,
	ProcessedContent,
} from '@kobun/common'
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

export type UniqueReturn = ProcessedContent<CollectionItemMetadata>

export type CollectionInterface<T extends SchemaKey> = {
	_label: string
	_schema: ConfigSchema<T>
	all: (params?: AllParams) => Promise<Record<string, unknown>[]>
	unique: (
		arg: UniqueArg,
	) => Promise<ProcessedContent<Record<string, unknown>>>
}

export type SingletonInterface<T extends SchemaKey> = {
	_label: string
	_schema: ConfigSchema<T>
	get: () => Promise<ProcessedContent<Record<string, unknown>>>
}

export interface CollectionsReader<T extends SchemaKey> {
	[collectionName: string]: CollectionInterface<T>
}

export interface SingletonsReader<T extends SchemaKey> {
	[singletonName: string]: SingletonInterface<T>
}

export interface KobunReader<T extends SchemaKey> {
	collections: CollectionsReader<T>
	singletons: SingletonsReader<T>
}
