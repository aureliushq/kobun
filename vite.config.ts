import { cloudflare } from "@cloudflare/vite-plugin"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { visualizer } from "rollup-plugin-visualizer"
import { defineConfig } from "vitest/config"
import packageJson from "./package.json" with { type: "json" }

const isStorybook = process.argv[1]?.includes("storybook")

export default defineConfig({
	define: {
		KOBUN_VERSION: JSON.stringify(packageJson.version),
	},
	resolve: {
		tsconfigPaths: true,
	},
	build: {
		sourcemap: true,
		rollupOptions: {
			onwarn(warning, warn) {
				// gray-matter ships an optional JS front-matter engine that uses direct
				// `eval` (node_modules/gray-matter/lib/engines.js). We disable that engine
				// at runtime (see app/lib/frontmatter.ts), so the code is dead - but it
				// still bundles, so Rolldown's eval check flags it. Silence ONLY this
				// specific warning; the check stays active, so a direct `eval` anywhere
				// else (our code or any other dependency) is still surfaced.
				const source = warning.id ?? warning.loc?.file ?? ""
				if (
					warning.code === "EVAL" &&
					source.includes("/node_modules/gray-matter/")
				) {
					return
				}
				// Third-party packages ship incomplete sourcemaps - nothing we can fix
				// https://github.com/vitejs/vite/issues/15012
				if (
					warning.message.includes(
						"Error when using sourcemap for reporting an error",
					)
				) {
					return
				}
				warn(warning)
			},
		},
	},
	plugins: [
		tailwindcss(),
		...(!process.env.VITEST && !isStorybook
			? [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()]
			: []),
		...(!process.env.CI
			? [
					visualizer({
						brotliSize: true,
						emitFile: true,
					}),
				]
			: []),
	],
	ssr: {
		noExternal: ["posthog-js", "@posthog/react"],
	},
	test: {
		// Restores all original implementations on spies created manually
		restoreMocks: true,

		// Clears mocks history
		clearMocks: true,

		// Pass if there are no tests (without which CI fails)
		// TODO: add unit tests
		passWithNoTests: true,

		coverage: {
			include: ["{app,packages}/**/*.{ts,tsx}"],
			exclude: ["**/*.stories.tsx"],
			reporter: ["text", "text-summary"],
			reportsDirectory: "./.reports/tests-coverage",
			thresholds: {
				statements: 0,
				branches: 0,
				functions: 0,
				lines: 0,
			},
		},

		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["{app,packages}/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "dom",
					environment: "happy-dom",
					include: ["{app,packages}/**/*.test.tsx"],
					setupFiles: ["./setup.dom.vitest.ts"],
				},
			},
		],
	},
})
