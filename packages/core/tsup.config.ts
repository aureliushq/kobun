import { defineConfig } from 'tsup'
import type { Options } from 'tsup'

const config: Options = {
	replaceNodeEnv: true,
	splitting: true,
	clean: false,
	format: ['esm'],
	skipNodeModulesBundle: true,
	dts: true,
	entry: ['src/index.tsx'],
	outDir: 'dist',
	bundle: true,
	minify: true,
	name: '@rescribejs/core',
	external: ['react', 'react-dom', 'react-router'],
}

export default defineConfig(config)
