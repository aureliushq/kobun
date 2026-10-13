# Kobun

**Git-based CMS for content and static sites.**

[Website](https://kobun.io) · [Hosted App](https://app.kobun.io) · [GitHub](https://github.com/aureliushq/kobun)

---

## How It Works

1. **Sign in** with GitHub.
2. **Install** the Kobun GitHub App on your user or organization account.
3. Kobun **lists** the repositories you've granted access to.
4. **Select a repository** to create a project.
5. Kobun looks for a **config file** (`.kobun.json`, `.kobun.yml` or `.kobun.yaml`) in the repository root.

## Tech Stack

- **Framework** — React Router v7 + Vite + React 19 + TypeScript
- **Runtime** — Cloudflare Workers + D1 (SQLite)
- **Auth** — Better Auth with GitHub OAuth
- **GitHub Integration** — Octokit + GitHub App
- **ORM** — Drizzle ORM
- **UI** — Tailwind CSS v4 + shadcn/ui + Base UI
- **Tooling** — Bun + Biome + Vitest + Playwright

## Writing a Config

The config declares your content: **Collections** (many items, such as blog posts) and **Singletons** (one item, such as site settings). Each one has a `label`, a `format` (`md`, `mdx`, `json` or `yaml`) and a `schema` of fields.

```json
{
  "$schema": "https://app.kobun.io/schemas/v1.json",
  "version": 1,
  "collections": {
    "posts": {
      "label": "Posts",
      "format": "md",
      "features": { "publish": true, "timestamps": { "updatedAt": true } },
      "schema": {
        "title": { "label": "Title", "type": "text", "required": true },
        "slug": { "label": "Slug", "type": "slug", "from": "title" },
        "cover": { "label": "Cover image", "type": "image" },
        "tags": {
          "label": "Tags",
          "type": "multi_select",
          "options": [
            { "label": "News", "value": "news" },
            { "label": "Guides", "value": "guides" }
          ]
        },
        "body": { "label": "Body", "type": "document" }
      }
    }
  },
  "singletons": {
    "site": {
      "label": "Site settings",
      "format": "json",
      "schema": {
        "title": { "label": "Site title", "type": "text" },
        "description": { "label": "Description", "type": "text", "multiline": true }
      }
    }
  }
}
```

The `$schema` line gives you autocomplete and validation in editors that support JSON Schema.

### Top-level keys

| Key | Required | What it is |
| --- | --- | --- |
| `version` | Yes | Config version. Use `1`. |
| `collections` | Yes | Map of Collection name → Collection. |
| `singletons` | No | Map of Singleton name → Singleton. |
| `basePath`, `mediaPath`, `mediaUrl` | No | Where content and images live. See [Config paths](#config-paths). |

### Field types

`text`, `slug`, `document`, `image`, `date`, `datetime`, `boolean`, `select`, `multi_select`, `url`, `object`, `array`.

Every field takes a `label`, and optionally `required` and `description`.

Rules:

- A Collection needs exactly one `slug` field. Its `from` names a `text` field in the same schema.
- A schema can have at most one `document` field (the body). It must be at the top level, and the format must be `md` or `mdx`.
- A Collection can declare `subcollections`, one level deep. Singletons cannot.

### Features

| Feature | What it adds |
| --- | --- |
| `publish: true` | `status` (Draft / Published) and `publishedAt` fields. |
| `timestamps.createdAt: true` | A `createdAt` field. |
| `timestamps.updatedAt: true` | An `updatedAt` field. |

### Config paths

`basePath` and `mediaPath` are relative to the repository root. `mediaUrl` is a path on your site.

| Option | Default | What it is |
| --- | --- | --- |
| `basePath` | `src/content` | Where Collections (`<basePath>/collections/<collection>/`) and Singletons (`<basePath>/singletons/`) live. |
| `mediaPath` | `src/assets/images` | Where images added in the editor are written on Save to GitHub or Publish, for example `src/assets/images/<id>.png`. |
| `mediaUrl` | `mediaPath` | What the Markdown links each image by. Set it when your site serves the media directory at another path: `mediaPath: "public/images"` with `mediaUrl: "/images"` links `/images/<id>.png`. |

## Self-Hosting

Kobun runs on Cloudflare Workers with D1. Self-hosting needs a Cloudflare account and a GitHub App. See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup, environment variables, scripts and deployment.

## Bug Reports and Feature Requests

Use [GitHub Issues](https://github.com/aureliushq/kobun/issues) for bug reports and feature requests. Outside pull requests are not accepted at this time. See [CONTRIBUTING.md](./CONTRIBUTING.md) for what to include.

## License

[FSL-1.1-MIT](./LICENSE) (Functional Source License, Version 1.1, MIT Future License).

- Source-available and free to use, modify, and self-host.
- Competing hosted services are not permitted.
- Each version converts to MIT after 2 years.
- See [LICENSE](./LICENSE) for full terms.

---

Built by [Ilango Rajagopal](https://github.com/i4o-oss).
