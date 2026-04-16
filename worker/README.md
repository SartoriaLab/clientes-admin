# marieta-sync — Cloudflare Worker

Worker que recebe payload do Menudino (enviado pelo bookmarklet na aba do
restaurante) e grava no Firestore de `cardapio-admin-prod` usando service
account. Existe pra desviar do CORS do Firebase Auth, que bloqueia chamadas
diretas a partir de `marietabistro.menudino.com`.

- **Custo:** R$ 0 (tier gratuito do Cloudflare Workers: 100k req/dia, sobra absurda).
- **Deploy:** `wrangler deploy` (tudo pela CLI).
- **Secrets:** gerenciados pelo Wrangler — nunca ficam no repo nem em disco depois do `secret put`.

## Setup inicial (uma vez só)

1. **Criar conta Cloudflare grátis**: https://dash.cloudflare.com/sign-up
2. **Instalar Wrangler globalmente:**
   ```bash
   npm install -g wrangler
   ```
3. **Login** (abre browser pra OAuth):
   ```bash
   wrangler login
   ```
4. **Instalar deps locais** (na pasta `worker/`):
   ```bash
   cd worker
   npm install
   ```
5. **Baixar service account do Firebase:**
   - Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key" → baixa JSON
   - **NÃO commitar no git.** Guardar temporariamente pra próximo passo.
6. **Configurar o secret do service account:**
   ```bash
   wrangler secret put SERVICE_ACCOUNT_JSON
   ```
   Cola o conteúdo inteiro do JSON (incluindo `{` e `}`) e Enter.
7. **Gerar e configurar o shared secret** (32 bytes aleatórios):
   ```bash
   # gera o token
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # cola o valor quando pedir
   wrangler secret put SHARED_SECRET
   ```
   Guarda o mesmo valor pra colar em `SyncMenudinoModal.jsx` depois.
8. **Deploy:**
   ```bash
   wrangler deploy
   ```
   Output vai mostrar a URL tipo `https://marieta-sync.<sua-conta>.workers.dev`.
   Anotar — é essa URL que vai no bookmarklet.

## Verificar que funciona

- Sem Origin válido: deve dar 403.
  ```bash
  curl -i -X POST https://marieta-sync.<sua-conta>.workers.dev
  # HTTP/2 403
  ```
- Sem secret: deve dar 401.
  ```bash
  curl -i -X POST https://marieta-sync.<sua-conta>.workers.dev \
    -H "Origin: https://marietabistro.menudino.com" \
    -H "Content-Type: text/plain" \
    --data '{"secret":"errado"}'
  # HTTP/2 401
  ```
- Preflight: deve dar 204 com CORS headers.
  ```bash
  curl -i -X OPTIONS https://marieta-sync.<sua-conta>.workers.dev \
    -H "Origin: https://marietabistro.menudino.com"
  # HTTP/2 204, Access-Control-Allow-Origin: https://marietabistro.menudino.com
  ```

## Comandos úteis

| Comando            | O que faz                                          |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Worker local em http://localhost:8787 (dev loop)    |
| `npm run deploy`   | Deploy pra Cloudflare                              |
| `npm run tail`     | Stream de logs de produção em tempo real           |
| `wrangler secret list` | Lista secrets configurados (sem mostrar valores) |
| `wrangler delete marieta-sync` | Remove o Worker (rollback total)        |

## Rotacionar o `SHARED_SECRET`

Se o secret vazar (ex: alguém fez scrape do bundle do admin):

1. Gera novo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. `wrangler secret put SHARED_SECRET` → cola o novo valor.
3. Atualiza `SyncMenudinoModal.jsx` com o novo valor e redeploy do admin.
4. Quem tentar com o secret antigo vai receber 401.

## Rotacionar o service account

Se a key do service account vazar:

1. Firebase Console → Service Accounts → Revoke a key comprometida.
2. Gera nova key, baixa o JSON.
3. `wrangler secret put SERVICE_ACCOUNT_JSON` → cola o novo JSON.

Não precisa redeploy — Worker lê o secret a cada request.

## Arquitetura

- `src/index.js` — entrada do Worker: CORS, validação, JWT signing (Web Crypto
  RS256), OAuth exchange, Firestore REST GET/PATCH, encoder/decoder do
  formato Firestore Value.
- `src/menudino-sync-lib.js` — funções puras de conversão + merge
  (`converterMenudino`, `converterBusinessInfo`, `mergeCardapio`,
  `mergeBusinessInfo`). **Duplicadas** de `src/lib/menudino-sync.js` do admin
  porque o Worker vive em deploy separado. Qualquer mudança na lógica de
  merge aqui deve ser replicada lá (e vice-versa).

## Rollback

Se quebrar tudo:
```bash
wrangler delete marieta-sync
```
O bookmarklet passa a falhar com "Failed to fetch", e o fluxo manual da
modal `SyncMenudinoModal` continua funcionando como fallback.
