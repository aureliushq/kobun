import type { Config } from '@rescribe/common'
import type { LoaderFunctionArgs } from 'react-router'

export type LoaderHandlerArgs = {
	config: Config
} & LoaderFunctionArgs
