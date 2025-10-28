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
pnpm --filter @shelterplus/api exec prisma migrate dev --schema prisma/schema.prisma
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

### Пример `OFFICIAL_CONFIG_JSON`

Если в журнале появляется ошибка `Failed to parse OFFICIAL_CONFIG_JSON`, убедитесь, что значение переменной окружения содержит корректный JSON. Чаще всего сообщение `SyntaxError: Expected property name or '}' in JSON` означает, что ключи (`guildId`, `voiceChannelId` и т. д.) указаны без кавычек. Ниже приведён корректный пример и распространённая ошибка для сравнения.

❌ Неверно (нет кавычек вокруг названий полей):

```text
OFFICIAL_CONFIG_JSON=[{guildId:"-1234680602842759292",voiceChannelId:"1432513881301057681"}]
```

✅ Верно (все строки и ключи окружены двойными кавычками):

```text
OFFICIAL_CONFIG_JSON=[{"guildId":"-1234680602842759292","voiceChannelId":"1432513881301057681"}]
```

А вот полный пример строки, которую можно добавить в `.env` (обратите внимание на экранирование кавычек):

```env
OFFICIAL_CONFIG_JSON="[{\"guildId\":\"-1234680602842759292\",\"apocalypse\":\"Наблюдательная чума\",\"bunker\":\"Подземный комплекс Север-7\",\"voiceChannelId\":\"1432513881301057681\",\"textChannelId\":\"1432513827471364209\"}]"
```

Либо задайте ту же структуру через переменные окружения хостинга/оркестратора без экранирования, передавая массив объектов в виде строки JSON:

```json
[
  {
    "guildId": "-1234680602842759292",
    "apocalypse": "Наблюдательная чума",
    "bunker": "Подземный комплекс Север-7",
    "voiceChannelId": "1432513881301057681",
    "textChannelId": "1432513827471364209"
  }
]
```

Поля `apocalypse` и `bunker` могут быть заполнены любыми значениями, а идентификаторы каналов должны соответствовать вашим серверу и каналам в Discord.
