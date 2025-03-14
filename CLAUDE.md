# Kobun Development Guide

## Build Commands
- Build all packages: `pnpm build`
- Build demo only: `pnpm build:demo`
- Start development: `pnpm dev`

## Code Quality
- Lint code: `pnpm lint`
- Format code: `pnpm format`
- Type checking: `turbo run check-types`

## Code Style
- **Formatting**: Uses Biome - tab indentation (width: 4)
- **Quotes**: Single quotes for JS/JSX
- **Semicolons**: As needed only
- **Imports**: Organized automatically with Biome
- **Types**: TypeScript with strict typing recommended
- **Error Handling**: Use try/catch with meaningful error messages
- **Naming**: Use camelCase for variables/functions, PascalCase for components/types
- **Component Structure**: React components with TypeScript props interfaces

## Project Structure
- Monorepo with Turborepo and pnpm workspaces
- Core React components in `packages/core`
- Server implementations in `packages/server`
- Demo application in `demo/`