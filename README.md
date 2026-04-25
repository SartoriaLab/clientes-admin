# cliente-admin

Painel admin multi-tenant para clientes (cardápios de restaurantes, garagens, academias). Frontend Vite+React, backend Firebase (Firestore + Auth + Storage), Cloudflare Worker para sync externo (Menudino + Instagram).

## Estrutura

```
src/                   Frontend React (Vite)
  pages/               Páginas roteadas (CardapioEditor, AdminUsuarios, …)
  components/          Componentes compartilhados (Layout, modais)
  contexts/            AuthContext, ToastContext
  hooks/               useRestaurantData, usePagedCollection
  lib/                 menudino-sync (orquestrador), google-oauth
  firebase.js          Init Firebase Web SDK

shared/                Código compartilhado entre browser e Worker
  menudino-sync-core.* Conversão e merge puro (Menudino → Firestore)
  __tests__/           Vitest

worker/                Cloudflare Worker (sync server-side)
  src/index.js         Rotas: /, /oauth/google/*
  src/menudino-sync-lib.js  Re-export de shared/

scripts/               Scripts one-off (seeds, migrações) — ver scripts/README.md
firestore.rules        Regras de segurança Firestore
firebase.json          Config Firebase Hosting
```

## Setup

```bash
npm install
cp .env.example .env   # preencher chaves Firebase + worker URL
npm run dev
```

### Variáveis de ambiente (cliente — bundle público)

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_GOOGLE_CLIENT_ID                 # OAuth Google (não-secret)
VITE_OAUTH_WORKER_URL                 # URL do Worker (rotas /oauth/*)
VITE_MENUDINO_SYNC_WORKER_URL         # URL do Worker (rota raiz)
VITE_MENUDINO_SYNC_SECRET             # bookmarklet shared secret
```

### Variáveis do Worker (`wrangler secret put`)

```
SERVICE_ACCOUNT_JSON       # Firebase service account JSON
SHARED_SECRET              # bookmarklet shared secret (igual ao VITE_MENUDINO_SYNC_SECRET)
GOOGLE_CLIENT_ID           # OAuth Google
GOOGLE_CLIENT_SECRET       # OAuth Google (server-side)
FIREBASE_API_KEY           # Web API key (pra validar Firebase ID tokens)
ADMIN_ORIGINS              # CSV: https://admin.exemplo.com,https://outro.app
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Build prod (chunks separados: firebase, pdf, dnd) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (suite shared/) |
| `npm run test:watch` | Vitest watch |
| `cd worker && npm run dev` | Worker local (wrangler) |
| `cd worker && npm run deploy` | Deploy Worker |

## Multi-tenant

- Tenants registrados em `Firestore tenantConfig/{slug}` com `{ slug, origins[], instagramUrl, handle }`.
- Worker carrega via Firestore com cache 5min, fallback hardcoded em `worker/src/index.js` (`TENANTS_FALLBACK`).
- Usuários têm `restaurantSlug` em `users/{uid}`. Rules de segurança garantem que clientes só editam seu próprio tenant; admins editam tudo.

## Segurança

- `firestore.rules` faz isolamento por tenant + role check (admin via `users/{uid}.role`).
- Service account JSONs **nunca** commitados (`.gitignore` cobre `serviceAccount*.json`).
- `GOOGLE_CLIENT_SECRET` vive só no Worker; browser troca code/refresh via `/oauth/google/*` autenticado por Firebase ID token.
- Bookmarklet `SHARED_SECRET` é necessariamente público (embutido no JS colado pelo user); rotacionar periodicamente via `wrangler secret put SHARED_SECRET`.

## Deploy

- Frontend: `npm run build` → `dist/` → Firebase Hosting (`firebase deploy --only hosting`).
- Worker: `cd worker && npm run deploy`.
- Rules: `firebase deploy --only firestore:rules`.

CI roda lint + test + build em PRs (`.github/workflows/ci.yml`).

## TODO arquitetural

Punch list completa em `~/.claude/plans/me-sugira-melhorias-groovy-rainbow.md`. Itens parciais:
- Quebrar páginas gigantes (`RelatorioSEOPage` 1290 linhas, `CardapioEditor` 869, `GestaoClientesPage` 736).
- Wirar `usePagedCollection` em listas Admin.
- Migrar `setAdminUser.js` → Cloud Function callable.
- TS migration progressiva (tsconfig.json + .d.ts já no lugar).
