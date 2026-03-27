# Kobun

**Git-based CMS for content and static sites.**

[Website](https://kobun.io) · [Hosted App](https://app.kobun.io) · [GitHub](https://github.com/aureliushq/kobun)

---

## How It Works

1. **Sign in** with GitHub.
2. **Install** the Kobun GitHub App on your user or organization account.
3. Kobun **lists** the repositories you've granted access to.
4. **Select a repository** to create a project.
5. Kobun looks for a **config file** (`.kobun.json` or `.kobun.yml`) in the repository root.

## Tech Stack

- **Framework** — React Router v7 + Vite + React 19 + TypeScript
- **Runtime** — Cloudflare Workers + D1 (SQLite)
- **Auth** — Better Auth with GitHub OAuth
- **GitHub Integration** — Octokit + GitHub App
- **ORM** — Drizzle ORM
- **UI** — Tailwind CSS v4 + shadcn/ui + Base UI
- **Tooling** — Bun + Biome + Vitest + Playwright

## Prerequisites

- Node.js >= 24.13.0
- Bun >= 1.3.8

> [!NOTE]
> A `.tool-versions` file is included for use with [mise](https://mise.jdx.dev/) or [asdf](https://asdf-vm.com/). Run `mise install` or `asdf install` to install the correct versions.

## Quick Start

```bash
bun install
cp .env.example .env
cp .dev.vars.example .dev.vars
bun run db:setup
bun run dev
```

> [!IMPORTANT]
> Fill in the values in `.env` and `.dev.vars` before using authentication or GitHub features. See the [Environment Variables](#environment-variables) section below.

The local app runs at [http://localhost:5173](http://localhost:5173).

## Environment Variables

### `.env` — Local scripts and remote DB migrations

| Variable | Description |
| --- | --- |
| `BETTER_AUTH_URL` | Base URL of the app (default: `http://localhost:5173`) |
| `BETTER_AUTH_SECRET` | Auth secret. Generate with `openssl rand -base64 32` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (needed for remote DB operations) |
| `CLOUDFLARE_DATABASE_ID` | Cloudflare D1 database ID (needed for remote DB operations) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (needed for remote DB operations) |

### `.dev.vars` — Runtime secrets for the local Wrangler dev server

| Variable | Description |
| --- | --- |
| `BETTER_AUTH_URL` | Base URL (`http://localhost:5173`) |
| `BETTER_AUTH_SECRET` | Auth secret (same as `.env`) |
| `GITHUB_CLIENT_ID` | GitHub App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub App client secret |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (single-line PEM) |
| `GITHUB_APP_WEBHOOK_SECRET` | GitHub App webhook secret |
| `GITHUB_APP_SLUG` | GitHub App slug (URL-friendly name) |

> [!TIP]
> GitHub App private keys are multi-line PEM files. Convert to a single-line string for `.dev.vars`:
>
> ```bash
> awk 'NR==1{printf "%s",$0; next}{printf "\\n%s",$0}' ~/path-to/your-app.private-key.pem | pbcopy
> ```

## Scripts

### Development

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run preview` | Build and preview the production build |
| `bun run storybook` | Start Storybook |

### Quality

| Command | Description |
| --- | --- |
| `bun run check` | Lint and format check (Biome) |
| `bun run check:fix` | Auto-fix lint and format issues |
| `bun run check:types` | TypeScript type check |
| `bun run doctor` | Run all checks + tests |

### Database

| Command | Description |
| --- | --- |
| `bun run db:setup` | Reset and reinitialize local database |
| `bun run db:generate` | Generate Drizzle migrations after schema changes |
| `bun run db:migrate` | Apply migrations locally |
| `bun run db:studio` | Open Drizzle Studio |

### Deployment

| Command | Description |
| --- | --- |
| `bun run deploy:preview` | Deploy to preview environment |
| `bun run deploy:production` | Deploy to production |

## Self-Hosting

Kobun is designed to run on Cloudflare Workers with D1. Self-hosting requires a Cloudflare account, a GitHub App, and some configuration. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide.

## Bug Reports and Feature Requests

Use [GitHub Issues](https://github.com/aureliushq/kobun/issues) for bug reports and feature requests. Outside pull requests are not accepted at this time.

## License

[FSL-1.1-MIT](./LICENSE) (Functional Source License, Version 1.1, MIT Future License).

- Source-available and free to use, modify, and self-host.
- Competing hosted services are not permitted.
- Each version converts to MIT after 2 years.
- See [LICENSE](./LICENSE) for full terms.

---

Built by [Ilango Rajagopal](https://github.com/i4o-oss).
