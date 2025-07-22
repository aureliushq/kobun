# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- Build all packages: `pnpm build`
- Build demo only: `pnpm build:demo`
- Start development: `pnpm dev`
- Deploy demo: `pnpm deploy:demo`
- Release packages: `pnpm release`

## Code Quality
- Lint code: `pnpm lint`
- Format code: `pnpm format`
- Type checking: `turbo run check-types`
- Clean everything: `pnpm nuke`

## Code Style
- **Formatting**: Uses Biome - tab indentation (width: 4)
- **Quotes**: Single quotes for JS/JSX
- **Semicolons**: As needed only
- **Imports**: Organized automatically with Biome
- **Types**: TypeScript with strict typing recommended
- **Error Handling**: Use try/catch with meaningful error messages
- **Naming**: Use camelCase for variables/functions, PascalCase for components/types
- **Component Structure**: React components with TypeScript props interfaces

## Project Architecture

### Monorepo Structure
- **Turborepo** with **pnpm workspaces** for package management
- **React Router v7** as the primary framework target
- Multiple publishable packages and a demo application

### Core Packages
- **@kobun/core**: Main React components and UI library
  - Rich text editor using TipTap
  - Form components with Conform and Zod validation
  - Radix UI primitives for accessible components
  - Tailwind CSS for styling
  - Exports: Main component (`Kobun`), provider (`KobunProvider`), and field types

- **@kobun/server**: Server-side utilities and handlers
  - Dual exports for Node.js (`/node`) and Cloudflare (`/cloudflare`) environments
  - File reading and content management utilities
  - Action and loader handlers for React Router integration
  - AWS S3 integration for Cloudflare Workers

- **@kobun/common**: Shared types and utilities
  - Zod schemas and TypeScript types
  - Field type definitions (text, boolean, date, array, object, etc.)
  - Configuration schemas for collections and singletons

### Additional Packages
- **@kobun/blog**: Blog-specific templates and components
- **@kobun/docs**: Documentation-specific templates and components
- **@kobun/client**: Client-side utilities
- **@kobun/tsconfig**: Shared TypeScript configurations

### Demo Application
- React Router v7 application showcasing Kobun features
- Example collections (articles, docs) with MDX content
- CMS integration examples
- Build target: `react-router build`
- Dev server: `react-router dev`

## Content Management System
- **Collections**: Structured content with customizable schemas (articles, blog posts, etc.)
- **Singletons**: Single-instance content (settings, about pages, etc.)
- **Field Types**: text, boolean, date, array, object, multiselect, slug, URL, image, document
- **Content Formats**: Markdown (md) and MDX support
- **Features**: Publishing workflow, timestamps, featured content

## Key Dependencies
- **React Router v7**: Primary framework (peer dependency)
- **TipTap**: Rich text editing
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Styling framework
- **Zod**: Schema validation
- **Conform**: Form handling
- **gray-matter**: Frontmatter parsing
- **AWS SDK**: S3 integration for Cloudflare