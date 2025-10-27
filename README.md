# ShelterPlus

Stage 1 implementation of the ShelterPlus platform. This repository contains a pnpm workspace with a NestJS API, a Next.js web application, and shared types.

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for Postgres and Redis)

## Getting started

```bash
pnpm install
docker compose up -d
pnpm prisma migrate dev --schema prisma/schema.prisma
pnpm --filter @shelterplus/api dev
pnpm --filter @shelterplus/web dev
```

Set the following environment variables for local development:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `OFFICIAL_CONFIG_JSON`
- `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3333`)

The API exposes lobby and game endpoints that orchestrate deterministic card dealing. The web UI lets hosts create lobbies, gather players, and start games. Discord interactions fall back to offline logging when the bot token is not configured.
