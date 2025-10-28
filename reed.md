# ShelterPlus Runbook

This document provides end-to-end instructions for setting up and running the ShelterPlus platform locally. The workspace contains a NestJS API (`apps/api`), a Next.js web application (`apps/web`), and a shared TypeScript package (`packages/shared`).

## 1. Prerequisites

Install the following tools before working with the repository:

| Tool | Version | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 20.x | Required for all workspace packages |
| [pnpm](https://pnpm.io/) | 8.x | Workspace package manager |
| [Docker](https://www.docker.com/) & Docker Compose | latest | Used to run Postgres and Redis locally |

> **Tip:** Use a Node version manager such as `fnm`, `nvm`, or `asdf` to install Node.js 20 alongside other versions.

## 2. Clone and install dependencies

```bash
# Clone the repository
 git clone <your-fork-or-the-upstream-url>
 cd ShelterPlus

# Install all workspace dependencies
 pnpm install
```

pnpm will hoist shared dependencies to the workspace root and install package-specific dependencies inside each workspace.

## 3. Configure environment variables

Create environment files before running the services. You can keep all variables in a single `.env` file at the repository root, or you can create package-specific files such as `apps/api/.env` and `apps/web/.env.local`. The NestJS API loads variables via `@nestjs/config`, and Next.js follows the standard `.env.local` convention.

### Required variables

| Variable | Service | Description |
| --- | --- | --- |
| `DATABASE_URL` | API & Prisma | PostgreSQL connection string. Defaults to `postgresql://postgres:postgres@localhost:5432/shelterplus`. |
| `NEXTAUTH_SECRET` | Web | Secret used by NextAuth for session signing. Generate with `openssl rand -base64 32`. |
| `DISCORD_CLIENT_ID` | Web | Discord OAuth client ID for login. Provide a placeholder if Discord auth is not configured. |
| `DISCORD_CLIENT_SECRET` | Web | Discord OAuth client secret. Provide a placeholder if Discord auth is not configured. |
| `DISCORD_BOT_TOKEN` | API | Enables Discord bot integration. Leave unset to run the API in offline mode (Discord features disabled). |
| `OFFICIAL_CONFIG_JSON` | API | JSON blob for the official game configuration. Defaults to the value exported from `@shelterplus/shared` when unset. |
| `NEXT_PUBLIC_API_URL` | Web | Base URL the web app uses to contact the API. Defaults to `http://localhost:3333`. |
| `SESSION_SECRET` | API | Secret for Express session cookies. Defaults to `development-secret`; override in production. |

### Optional variables

| Variable | Service | Description |
| --- | --- | --- |
| `PORT` | API | Port for the NestJS API (defaults to `3333`). |

## 4. Start supporting services (Postgres & Redis)

Use Docker Compose to launch the local Postgres and Redis instances defined in `docker-compose.yml`:

```bash
docker compose up -d
```

This command starts the containers in detached mode. Postgres binds to `localhost:5432`, and Redis binds to `localhost:6379`.

To stop the services later, run `docker compose down` (append `-v` to remove volumes).

## 5. Apply database migrations

Run Prisma migrations to prepare the Postgres schema:

```bash
pnpm --filter @shelterplus/api exec prisma migrate dev --schema prisma/schema.prisma
```

This command creates the development database (if needed), applies all migrations, and generates the Prisma client used by the API.

If you change the Prisma schema, re-run `pnpm prisma generate` to regenerate the client.

## 6. Run the NestJS API

Start the API in watch mode:

```bash
pnpm --filter @shelterplus/api start:dev
```

The API listens on `http://localhost:3333` by default. Use the `PORT` environment variable to override the port if necessary. The console will log `API running on http://localhost:<port>` once the service is ready.

For a production build:

```bash
pnpm --filter @shelterplus/api build
pnpm --filter @shelterplus/api start
```

## 7. Run the Next.js web application

Start the frontend in development mode:

```bash
pnpm --filter @shelterplus/web dev
```

The app is available at `http://localhost:3000`. It communicates with the API using `NEXT_PUBLIC_API_URL`.

For a production build:

```bash
pnpm --filter @shelterplus/web build
pnpm --filter @shelterplus/web start
```

## 8. Workspace linting and quality checks

Run the shared lint script to check all packages:

```bash
pnpm lint
```

Each workspace also exposes package-specific commands such as `pnpm --filter @shelterplus/api lint` or `pnpm --filter @shelterplus/web lint`.

## 9. Troubleshooting

| Issue | Resolution |
| --- | --- |
| API fails to connect to Postgres | Ensure Docker containers are running and `DATABASE_URL` points to the correct host/port. | 
| Discord integration logs "offline mode" | Provide `DISCORD_BOT_TOKEN`; otherwise Discord features remain disabled. |
| Next.js cannot reach the API | Verify `NEXT_PUBLIC_API_URL` matches the API's host and port. |
| Prisma migrate errors about existing data | Drop the development database or use `pnpm prisma migrate reset` to reapply migrations from scratch. |

## 10. Shutting everything down

1. Stop the Next.js and NestJS processes (`Ctrl+C` in each terminal).
2. Stop Docker services: `docker compose down`.
3. Optionally remove the Postgres volume: `docker compose down -v`.

You now have a complete local workflow for running ShelterPlus end to end.
