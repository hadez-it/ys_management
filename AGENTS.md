# Repository Guidelines

## Project Structure & Module Organization
YS SVC is a service-shop management application built with React 19, TypeScript, Tailwind CSS v4, Express, and MongoDB/Mongoose.
- `src/components/` contains UI components; `src/App.tsx` coordinates the workspace.
- `src/lib/` holds local caching, offline synchronization, and optimistic-update helpers. Shared domain types live in `src/types.ts`.
- `api/index.ts` contains the Express API, database models, authentication, and authorization.
- `server.ts` integrates the API with Vite locally and serves built assets in production.
- `public/` contains static assets, the web manifest, and service worker. `dist/` is generated output; do not edit it.
- `netlify/functions/api.ts` wraps the API for Netlify; deployment settings also live in `netlify.toml` and `vercel.json`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `cp .env.example .env`: initialize local configuration; populate required values before starting.
- `npm run dev`: start Express with Vite middleware at `http://localhost:3000` (or `PORT`).
- `npm run lint`: run TypeScript checking (`tsc --noEmit`), not ESLint.
- `npm run build`: build the frontend and bundle the Node server into `dist/server.cjs`.
- `NODE_ENV=production npm start`: serve the production build.

## Coding Style & Naming Conventions
Use TypeScript, functional React components, two-space indentation, and semicolons. Match surrounding quote style: frontend files commonly use single quotes, while server files use double quotes. Use PascalCase for component files and types, and camelCase for functions, variables, and utility modules. Reuse shared domain types and existing Tailwind patterns. No dedicated formatter or ESLint configuration is present.

## Testing Guidelines
There is currently no automated test suite, test script, or coverage threshold. Run `npm run lint` and `npm run build`, then manually verify affected workflows. For authentication or permissions changes, check allowed and denied roles against the README authorization matrix. For caching changes, verify offline behavior and session restoration. Record verification steps in the PR.

## Commit & Pull Request Guidelines
Follow the existing commit pattern: `feat:`, `fix:`, `refactor:`, or `perf:` followed by a concise imperative summary. Keep changes focused. PRs should describe behavior changes, link relevant issues, list verification performed, and include screenshots for UI changes. Highlight configuration or deployment impacts.

## Security & Configuration
Never commit `.env` files or credentials. Configure `MONGO_URI`, a non-placeholder `JWT_SECRET` of at least 32 characters, and `INITIAL_ADMIN_PASSWORD` of at least 12 characters. Preserve server-side role enforcement and HTTP-only session cookies. Keep security state persistent in MongoDB so serverless deployments remain safe across instances.
