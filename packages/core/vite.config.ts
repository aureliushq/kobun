import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
// vite.config.ts
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import * as packageJson from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		lib: {
			// Entry point for your library
			entry: resolve(__dirname, 'src/index.tsx'),
			// Library name that will be used in UMD builds
			name: 'rescribe-core',
			// Generates .cjs.js, .es.js, and .umd.js files
			fileName: (format) => `rescribe-core.${format}.js`,
			// Supported formats
			formats: ['es', 'umd', 'cjs'],
		},
		rollupOptions: {
			// Externalize peer dependencies
			external: [...Object.keys(packageJson.peerDependencies || {})],
			output: {
				// Global variables to use in UMD build for externalized deps
				globals: {
					react: 'React',
					'react-dom': 'ReactDOM',
				},
			},
		},
		// Generate sourcemaps
		sourcemap: true,
		// Ensure clean build directory
		emptyOutDir: true,
	},
	plugins: [
		react(),
		dts({
			insertTypesEntry: true,
		}),
	],
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
		},
	},
})
