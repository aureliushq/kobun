import type { Config } from '@runica/common'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

export type ActionHandlerArgs = {
	config: Config
} & ActionFunctionArgs

export type LoaderHandlerArgs = {
	config: Config
} & LoaderFunctionArgs
