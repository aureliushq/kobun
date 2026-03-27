# Deployment and Self-Hosting Guide

## Overview

Kobun runs on [Cloudflare Workers](https://workers.cloudflare.com/) with [D1](https://developers.cloudflare.com/d1/) (SQLite) for storage. Authentication and repository access are handled through a single GitHub App — it serves as both the OAuth provider (via [Better Auth](https://www.better-auth.com/)) and the mechanism for accessing user repositories (via installation tokens and [Octokit](https://github.com/octokit/octokit.js)).

This guide covers everything needed to deploy Kobun, whether for production self-hosting or full development.

---

## Deployment Environments

| Environment | URL | Database | Deploys via |
| --- | --- | --- | --- |
| Development | `http://localhost:5173` | Local D1 (SQLite file) | `bun run dev` |
| Preview | Worker preview URL | Preview D1 | GitHub Actions on PR |
| Production | Custom domain / Worker URL | Production D1 | GitHub Actions on Release |

> [!NOTE]
> Preview and production URLs depend on your Cloudflare Worker name and custom domain configuration.

---

## Prerequisites

- [Cloudflare](https://dash.cloudflare.com/sign-up) account
- [GitHub](https://github.com) account
- [Node.js](https://nodejs.org/) >= 24.13.0
- [Bun](https://bun.sh/) >= 1.3.8

> **Development only** — this section is for contributors and is not required for production self-hosting.
>
> - [GitHub CLI](https://cli.github.com/) (`gh`) — needed for the release workflow

---

## Cloudflare Setup

### Create D1 Databases

For production self-hosting, you need at least one database. First, log in to Cloudflare via Wrangler:

```bash
bunx wrangler login
bunx wrangler d1 create kobun-production
```

> [!TIP]
> Your Cloudflare account ID can be found by running `bunx wrangler whoami` or in the [Cloudflare dashboard](https://dash.cloudflare.com/) URL (`dash.cloudflare.com/<account-id>`).

> **Development only** — create additional databases for development and preview:
>
> ```bash
> bunx wrangler d1 create kobun-development
> bunx wrangler d1 create kobun-preview
> ```

### Update wrangler.json

Update `wrangler.json` with your worker name, database names, and database IDs returned from the commands above. Update the `BETTER_AUTH_URL` var in each environment to match your domain.

---

## GitHub App Setup

A single GitHub App handles both user authentication (OAuth) and repository access (installation tokens). Create one at [github.com/settings/apps/new](https://github.com/settings/apps/new).

### App Settings

| Setting | Value |
| --- | --- |
| Homepage URL | Your app URL (e.g., `https://your-domain.com`) |
| Callback URL | `https://your-domain.com/api/auth/callback/github` |
| Setup URL (optional) | `https://your-domain.com/setup` |
| Webhook URL | Your webhook endpoint (if using webhooks) |
| Webhook secret | Generate a secure random string |

### Permissions

**Repository permissions:**

| Permission | Access |
| --- | --- |
| Administration | Read & write |
| Contents | Read & write |
| Metadata | Read-only |

**Account permissions:**

| Permission | Access |
| --- | --- |
| Email addresses | Read-only |

### Events

Subscribe to: **Installation target**, **Create**, **Delete**, **Push**, **Repository**

### After Creation

From the app settings page, collect:

- **Client ID** — under "General"
- **Client secret** — generate one under "General"
- **App ID** — shown at the top of the app settings
- **App slug** — the URL-friendly name (from the app's public URL: `github.com/apps/<slug>`)
- **Private key** — generate and download under "General"
- **Webhook secret** — the value you set during creation

### Private Key Format

The downloaded `.pem` file is multi-line. For environment variables, convert it to a single line with literal `\n`:

```bash
awk 'NR==1{printf "%s",$0; next}{printf "\\n%s",$0}' ~/path-to/your-app.private-key.pem | pbcopy
```

> [!TIP]
> Kobun automatically handles PKCS#1 to PKCS#8 conversion at runtime — no manual key conversion needed.

---

## Environment Variables

### Production Self-Hosting (Wrangler Secrets)

These are set via `wrangler secret put` and injected at runtime:

| Variable | Description |
| --- | --- |
| `BETTER_AUTH_SECRET` | Auth secret. Generate: `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` | GitHub App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub App client secret |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (single-line PEM) |
| `GITHUB_APP_WEBHOOK_SECRET` | GitHub App webhook secret |

To set secrets for production:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET --env production
bunx wrangler secret put GITHUB_CLIENT_ID --env production
bunx wrangler secret put GITHUB_CLIENT_SECRET --env production
bunx wrangler secret put GITHUB_APP_PRIVATE_KEY --env production
bunx wrangler secret put GITHUB_APP_WEBHOOK_SECRET --env production
```

### Production Non-Secret Variables

These are set in `wrangler.json` under `vars`:

| Variable | Description |
| --- | --- |
| `BETTER_AUTH_URL` | Your app's public URL |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_SLUG` | GitHub App slug |

> **Development only** — for local development, secrets go in `.dev.vars`:
>
> ```
> BETTER_AUTH_URL=http://localhost:5173
> BETTER_AUTH_SECRET=your-secret
> GITHUB_CLIENT_ID=your-client-id
> GITHUB_CLIENT_SECRET=your-client-secret
> GITHUB_APP_ID=your-app-id
> GITHUB_APP_PRIVATE_KEY=your-private-key-single-line
> GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret
> GITHUB_APP_SLUG=your-app-slug
> ```

> **Development only** — for local scripts and remote DB operations, configure `.env`:
>
> ```
> BETTER_AUTH_URL=http://localhost:5173
> BETTER_AUTH_SECRET=your-secret
> CLOUDFLARE_ACCOUNT_ID=your-account-id
> CLOUDFLARE_DATABASE_ID=your-database-id
> CLOUDFLARE_API_TOKEN=your-api-token
> ```

---

## Database Migrations

Run migrations against your production D1 database:

```bash
bun run db:migrate:production
```

> [!IMPORTANT]
> This requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in `.env`, and the production database ID in `wrangler.json`. You can [create an API token here](https://dash.cloudflare.com/profile/api-tokens) — it needs **D1:Edit** and **Workers Scripts:Edit** permissions.

> **Development only** — for local development:
>
> ```bash
> bun run db:setup    # full reset: init + generate + migrate + seed
> bun run db:migrate  # apply pending migrations only
> ```
>
> For preview environment:
>
> ```bash
> bun run db:migrate:preview
> ```

---

## Deploy

### Manual Production Deployment

```bash
bun run deploy:production
```

This builds the app and deploys to Cloudflare Workers using the production environment from `wrangler.json`.

> **Development only** — preview deployment:
>
> ```bash
> bun run deploy:preview
> ```

---

## GitHub Actions CI/CD

> **Development only** — this entire section is for contributors and is not required for production self-hosting. You can deploy manually using the commands above.

### Repository Variables

Set via GitHub UI (Settings → Secrets and variables → Actions) or `gh` CLI:

```bash
gh variable set CLOUDFLARE_ACCOUNT_ID --body "your-account-id"
```

| Variable | Required | Description |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `CLOUDFLARE_ACCESS_CLIENT_ID` | No | For smoke tests behind Cloudflare Access |

### Repository Secrets

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_API_TOKEN --app dependabot
```

| Secret | Required | Description |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | Needs D1:Edit and Workers Scripts:Edit permissions. [Create one here](https://dash.cloudflare.com/profile/api-tokens). |
| `CLOUDFLARE_ACCESS_CLIENT_SECRET` | No | For smoke tests behind Cloudflare Access |

> [!NOTE]
> Set the Dependabot secret separately so Dependabot PRs can perform preview deploys.

---

## CI/CD Pipeline

> **Development only** — this entire section is for contributors and is not required for production self-hosting.

| Event | Workflow | What happens |
| --- | --- | --- |
| Pull request | `deploy.yml` | Checks + tests + preview deploy |
| Push to `main` | `ci.yml` | Checks + tests only (no deploy) |
| GitHub Release published | `release.yml` | Checks + tests + production DB migration + production deploy + smoke tests |

> [!IMPORTANT]
> Production deployments **only** happen when a GitHub Release is published. Pushing to `main` does not deploy to production.

The preview database is shared across all PRs. To reset it, manually trigger the "Reset preview database" workflow in GitHub Actions.

---

## Release Workflow

> **Development only** — this entire section is for contributors and is not required for production self-hosting.

Releases are managed with [Changesets](https://github.com/changesets/changesets). See [`.github/RELEASE_WORKFLOW.md`](.github/RELEASE_WORKFLOW.md) for the full workflow.

Quick summary:

1. `bun run release:prepare` — bump version, create release PR
2. Merge the PR
3. `bun run release:publish` — create git tag and draft GitHub Release
4. Publish the GitHub Release on GitHub to trigger production deployment
