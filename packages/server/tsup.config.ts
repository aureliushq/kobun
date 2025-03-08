import { defineConfig } from 'tsup'
import type { Options } from 'tsup'

const config: Options = {
	replaceNodeEnv: true,
	splitting: true,
	clean: false,
	format: ['esm'],
	skipNodeModulesBundle: true,
	dts: true,
	entry: ['src/cloudflare.ts', 'src/node.ts'],
	outDir: 'dist',
	bundle: true,
	minify: true,
	name: '@kobun/server',
	external: [],
}

export default defineConfig(config)
