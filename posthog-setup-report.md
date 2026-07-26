# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Kobun, a GitHub-backed CMS built on React Router 8 and Cloudflare Workers. The integration covers client-side analytics (posthog-js), server-side event capture with per-request client correlation (posthog-node via middleware), user identification on every authenticated page load, and error tracking in the root error boundary.

**Files created:**
- `app/lib/posthog-middleware.ts` — React Router middleware that creates a per-request `posthog-node` client, extracts `X-POSTHOG-SESSION-ID` / `X-POSTHOG-DISTINCT-ID` headers set automatically by posthog-js, and wires up `withContext` so all server-side captures in downstream route handlers share the same session and user.

**Files modified:**
- `app/entry.client.tsx` — Initializes posthog-js with `tracing_headers` (so every fetch to the same hostname includes PostHog session/distinct-ID headers) and wraps the app in `PostHogProvider`.
- `app/root.tsx` — Exports the `posthogMiddleware` array so the middleware runs on every request, and adds `posthog.captureException()` to the `ErrorBoundary`.
- `app/core/components/layouts/dashboard.tsx` — Calls `posthog.identify(user.id, { name: user.name })` on every authenticated dashboard load so returning sessions are always linked to the correct person.
- `app/routes/login.tsx` — Captures `login_initiated` when the user submits the Login with GitHub form.
- `app/routes/setup.tsx` — Captures `project_created` (with `repo_owner` and `repo_name` properties) and `github_app_installed` server-side from the setup action.
- `app/routes/dashboard.tsx` — Captures `draft_discarded` server-side (with `collection_slug`) when a draft is permanently deleted.
- `app/routes/collection-editor.tsx` — Captures `content_published` server-side (with `collection_slug`, `repo_owner`, `repo_name`, `editor_mode`) after a successful GitHub push.

**Environment variables added to `.env`:**
- `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`
- `VITE_PUBLIC_POSTHOG_HOST`

| Event | Description | File |
|-------|-------------|------|
| `login_initiated` | User clicks the Login with GitHub button on the login page. | `app/routes/login.tsx` |
| `github_app_installed` | User installs the Kobun GitHub App during setup, redirecting to GitHub. | `app/routes/setup.tsx` |
| `project_created` | User creates a new project by selecting a repository during setup. | `app/routes/setup.tsx` |
| `draft_discarded` | User discards an editor draft permanently from the dashboard. | `app/routes/dashboard.tsx` |
| `content_published` | User publishes a collection item to GitHub from the editor. | `app/routes/collection-editor.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/232447/dashboard/849192)
- [Onboarding funnel (wizard)](https://eu.posthog.com/project/232447/insights/iaPhV7WA)
- [Login attempts (wizard)](https://eu.posthog.com/project/232447/insights/V7yq2foQ)
- [Projects created (wizard)](https://eu.posthog.com/project/232447/insights/202xI09U)
- [Content published (wizard)](https://eu.posthog.com/project/232447/insights/TJNpsn2a)
- [Content published by collection (wizard)](https://eu.posthog.com/project/232447/insights/ZJtyNlLR)

## Verify before merging

- [x] Run a full production build (`bun run build`) and fix any lint or type errors introduced by the generated code.
- [x] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [x] Add `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` to `.dev.vars.example` and any CI/deployment scripts so collaborators and production builds know what to set. For Cloudflare Workers deployments, these Vite env vars must also be present as build-time environment variables (e.g. via `wrangler secret` or CI env vars) since they are bundled at build time, not read at worker runtime.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the wizard added it to the dashboard layout loader, which covers every authenticated visit, but verify it fires on hard refreshes and direct navigation to deep links.
- [ ] This project contains GitHub and Cloudflare data sources that PostHog can import into its data warehouse. Run `npx @posthog/wizard warehouse` to connect them.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
