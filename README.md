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

Set the following environment variables for local development (copy `.env.example` as a starting point):

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `OFFICIAL_CONFIG_JSON`
- `API_ALLOWED_ORIGINS` (comma-separated list of browser origins allowed to call the API)
- `NEXT_PUBLIC_WEB_URL` (the public origin of the web app; used for redirects and link building)
- `NEXT_PUBLIC_API_URL` (the origin exposed by the API itself)
- `API_ENABLE_HTTPS` (set to `true` to enable local HTTPS when certificates are available)
- `API_HTTPS_CERT_PATH` and `API_HTTPS_KEY_PATH` (paths to the TLS certificate/key when HTTPS is enabled)

The API exposes lobby and game endpoints that orchestrate deterministic card dealing. The web UI lets hosts create lobbies, gather players, and start games. Discord interactions fall back to offline logging when the bot token is not configured.

## Local HTTPS for the API

The NestJS API serves HTTP by default. Enable HTTPS in development by setting `API_ENABLE_HTTPS=true` and pointing `API_HTTPS_CERT_PATH` / `API_HTTPS_KEY_PATH` at a certificate pair. A convenient way to create trusted certificates is [`mkcert`](https://github.com/FiloSottile/mkcert):

```bash
cd apps/api
mkdir -p certs
mkcert -install
mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost
```

After generating the certificates, set:

```env
API_ENABLE_HTTPS=true
API_HTTPS_CERT_PATH=apps/api/certs/cert.pem
API_HTTPS_KEY_PATH=apps/api/certs/key.pem
NEXT_PUBLIC_API_URL=https://localhost:3333
```

The API trusts the `X-Forwarded-Proto` and `Host` headers when `API_TRUST_PROXY` (or `TRUST_PROXY`) is left at its default value of `true`, so reverse proxies can terminate TLS while the API still builds correct absolute URLs. If the specified certificate files are missing, the server logs a warning and starts in HTTP mode instead of crashing.

### Verifying origin handling

- Automated: `pnpm --filter @shelterplus/api test:origin` ensures the request-origin helper builds absolute URLs correctly.
- Manual: start the API and web app, create a lobby, and verify that the invite/share links use the same origin that served the page. Repeat the check with `API_ENABLE_HTTPS=true` to confirm redirects switch to `https://` automatically.

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

Если вы редактируете `.env`, используйте «сырой» JSON без экранирования:

```env
OFFICIAL_CONFIG_JSON=[{"guildId":"-1234680602842759292","apocalypse":"Наблюдательная чума","bunker":"Подземный комплекс Север-7","voiceChannelId":"1432513881301057681","textChannelId":"1432513827471364209"}]
```

В интерактивной оболочке Linux/macOS удобно обернуть значение в одинарные кавычки, чтобы не экранировать двойные:

```bash
export OFFICIAL_CONFIG_JSON='[{"guildId":"-1234680602842759292","apocalypse":"Наблюдательная чума","bunker":"Подземный комплекс Север-7","voiceChannelId":"1432513881301057681","textChannelId":"1432513827471364209"}]'
```

#### Как проверить текущее значение

1. Выполните `pnpm --filter @shelterplus/api diagnose:official-config`. Скрипт автоматически подхватывает `.env` из корня репозитория или из `apps/api/.env`, печатает найденное значение и пытается его распарсить.
2. Если парсинг не удался, вывод подскажет, чего не хватает (например, кавычек вокруг ключей или лишних обратных слешей).

Полезно также убедиться, что в логах API после запуска больше не появляется сообщение `Failed to parse OFFICIAL_CONFIG_JSON`.

Поля `apocalypse` и `bunker` могут быть заполнены любыми значениями, а идентификаторы каналов должны соответствовать вашим серверу и каналам в Discord.
