import { defineConfig } from 'tsup'
import type { Options } from 'tsup'

const config: Options = {
	replaceNodeEnv: true,
	splitting: true,
	clean: false,
	format: ['cjs', 'esm'],
	skipNodeModulesBundle: true,
	dts: true,
	entry: ['src/index.tsx'],
	outDir: 'dist',
	bundle: true,
	minify: true,
	name: '@rescribejs/core',
	external: ['react', 'react-dom', '@remix-run/react'],
}

export default defineConfig(config)
