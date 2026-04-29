# Plano: Rastreamento de Leads por Tráfego (MVP)

## Contexto

Possível cliente perguntou se o produto rastreia leads por origem de tráfego (UTMs/Ads). Hoje **não rastreia**: o c-admin tem apenas `RelatorioSEOPage` com Search Console + GoatCounter (referrer HTTP genérico, sem atribuição por lead).

Objetivo do MVP: capturar UTMs/gclid/fbclid no site do cliente, propagar para WhatsApp, registrar cada interação como "lead" no Firestore com sua origem, e exibir relatório no admin com agregação por canal. Permite responder ao cliente "sim, temos" e fechar venda sem prometer plataforma de atribuição completa.

Escopo deliberadamente fora: pixel server-side, integração Meta/Google Ads API, multi-touch attribution, lead scoring. Esses ficam para v2.

## Arquitetura

Reusa infra existente: **Cloudflare Worker** (`worker/src/index.js`) já tem service account Firebase + lógica multi-tenant via `Origin` header / `tenantConfig`. Adiciona-se uma nova rota `POST /lead` no mesmo Worker. Nada de Cloud Functions novas.

```
Site cliente (marietabistro.com.br)
  └── <script src="https://worker.../track.js?tenant=marieta-bistro">
        ├─ Captura UTMs/referrer/landing no carregamento (localStorage 30d)
        ├─ Reescreve links wa.me/api.whatsapp.com pra anexar ?utm_*
        ├─ Em forms: injeta hidden inputs utm_*
        └─ No clique de WhatsApp ou submit: POST → Worker /lead
              └─ Worker valida tenant (Origin) + grava
                  Firestore: restaurants/{slug}/leads/{auto-id}
                                ↑
Admin (c-admin)              lê
  └── RelatorioLeadsPage.jsx (nova rota /relatorio-leads)
        ├─ Tabela leads (data, origem, canal, landing, tipo)
        ├─ Agregação: pizza por source, barras por campaign
        └─ Filtro de período (7d/30d/90d/custom)
```

## Schema Firestore

`restaurants/{slug}/leads/{leadId}`:
```js
{
  ts: Timestamp,
  type: 'whatsapp_click' | 'form_submit' | 'phone_click',
  source: 'google' | 'instagram' | 'facebook' | 'direct' | ...,  // utm_source
  medium: 'cpc' | 'organic' | 'social' | ...,                    // utm_medium
  campaign: string | null,
  content: string | null,
  term: string | null,
  gclid: string | null,
  fbclid: string | null,
  referrer: string | null,        // document.referrer no 1º hit
  landingPage: string,            // URL da 1ª página (sem query)
  currentPage: string,            // página onde converteu
  sessionId: string,              // uuid local 30d
  userAgent: string,
  meta: { phone?, message?, formData? }   // payload contextual
}
```

Atribuição: **first-touch** (UTMs persistem em localStorage 30d; sobrescreve só se nova URL trouxer novos UTMs — comportamento padrão GA).

## Arquivos a criar/modificar

### Novos
- **`worker/public/track.js`** (~150 linhas, vanilla JS, IIFE)
  - Lê `utm_*`, `gclid`, `fbclid`, `document.referrer`, `location.href`
  - `localStorage['c_lead']` com TTL 30d, `sessionId` UUID
  - Reescreve `a[href*="wa.me"]`, `a[href*="api.whatsapp.com"]` adicionando query
  - Reescreve `a[href^="tel:"]` registra clique
  - `MutationObserver` pra links injetados depois (SPA)
  - `fetch(WORKER_URL + '/lead', {method:'POST', body: payload})` no clique
  - Param `?tenant=SLUG` no script src identifica tenant (Origin valida)

- **`worker/src/leads.js`** (~80 linhas)
  - Handler `POST /lead`: valida `Origin` ∈ tenants conhecidos, sanitiza payload, grava `restaurants/{slug}/leads` via Firestore REST (reusa `getGoogleAccessToken` já existente)
  - Rate-limit simples: máx 10 req/min/IP via Cloudflare KV ou só `cf.connectingIp` em memory

- **`src/pages/RelatorioLeadsPage.jsx`** (~400 linhas)
  - Padrão visual de `RelatorioSEOPage.jsx` (KPIs cards + tabela + filtros)
  - Hook: `useLeads(slug, periodo)` lê `restaurants/{slug}/leads` ordenado por `ts desc`
  - Agregações com `useMemo`: por source, por medium, por campaign, por dia
  - Recharts (já no projeto via SEO page) pra pizza + barras
  - Export CSV simples

- **`INTEGRACAO_LEADS.md`** — doc curta com snippet pro cliente colar no `<head>` + exemplos de URL com UTM pra Meta/Google Ads

### Modificar
- **`worker/src/index.js`**: adicionar rota `if (url.pathname === '/lead') return handleLead(req, env)` antes do handler atual de `/sync`. Importar de `./leads.js`.
- **`worker/wrangler.toml`**: servir `track.js` estático (assets binding) ou rota dedicada que retorna JS com `Content-Type: application/javascript` + CORS `*`.
- **`firestore.rules`**: adicionar leitura de `leads` subcollection (já coberta pelo wildcard `match /{subcollection}/{docId}` linha 33 — **nada a mudar**, owner do tenant lê leads do próprio slug). Confirmar.
- **`src/App.jsx`** (ou roteador): rota `/relatorio-leads` apontando pra `RelatorioLeadsPage`.
- **Sidebar/menu** (achar componente que lista `RelatorioSEOPage`): adicionar link "Leads".

## Arquivos-chave a consultar durante implementação

- `worker/src/index.js:1-80` — padrão de handler, `getGoogleAccessToken`, `loadTenants`, `decodeFields`
- `src/pages/RelatorioSEOPage.jsx` — padrão de página de relatório (filtros, KPIs, gráficos, export PDF)
- `src/lib/clientTypes.js` — caso queira tipo de lead diferenciado por tipo de cliente
- `firestore.rules:33-36` — wildcard subcollection já cobre `leads`

## Verificação end-to-end

1. **Worker local**: `cd worker && npm run dev`. Testar `curl -X POST http://localhost:8787/lead -H "Origin: https://marietabistro.com.br" -d '{"type":"whatsapp_click","source":"google","medium":"cpc"}'`. Verificar doc em `restaurants/marieta-bistro/leads`.
2. **Track.js standalone**: criar `test.html` local com `<script src="http://localhost:8787/track.js?tenant=marieta-bistro">` + link `wa.me/55...`. Abrir com `?utm_source=google&utm_medium=cpc&utm_campaign=teste`. Inspecionar: link reescrito? localStorage populado? clique gera POST?
3. **Persistência first-touch**: abrir com UTMs, fechar, reabrir sem UTMs, clicar WhatsApp → lead deve manter UTMs originais.
4. **Admin**: `npm run dev`, login como owner de `marieta-bistro`, navegar `/relatorio-leads`, ver leads de teste agregados.
5. **Deploy stage**: subir Worker em rota `/lead`, colar snippet em UM site cliente (marieta-bistro), gerar tráfego com UTM teste, validar 24h.
6. **Lighthouse**: confirmar `track.js` < 5KB gzip e não bloqueia render (defer/async).

## Riscos / Notas

- **LGPD**: armazenamos IP/UA/UTM. Adicionar linha na privacy do cliente. Sem PII direta — só `meta.phone` se cliente preencher form.
- **Adblockers**: alguns bloqueiam scripts em domínio diferente. Mitigação v2: servir `track.js` no próprio domínio do cliente via Cloudflare Worker route ou copiar arquivo no build do site.
- **Rate-limit**: bot pode floodar. Worker valida Origin, mas adicionar throttle por IP (10/min) na v1.
- **Custo Firestore**: 1 write/lead. Tenant médio com 100 leads/dia = 3k writes/mês = irrisório.

## Estimativa

- Worker `/lead` + `track.js`: 1 dia
- `RelatorioLeadsPage`: 1.5 dia
- Docs + onboarding cliente piloto: 0.5 dia
- Buffer/QA: 1 dia
- **Total: ~4 dias úteis**

---

# Plano de Integração (Onboarding + Operação)

Como cada novo cliente pluga o rastreamento. Cobre dev, instalação no site do cliente, configuração de campanhas Ads, validação e operação.

## Etapa 1 — Cadastro do tenant no admin

**Quem:** você (admin).
**Onde:** `c-admin → Gestão de Clientes`.

1. Cliente já existe em `restaurants/{slug}` + `tenantConfig/{slug}` (fluxo atual).
2. Adicionar campo novo `tenantConfig.leadTracking = { enabled: true, createdAt }`.
3. Worker `loadTenants()` já cacheia 5min — propaga sozinho.

**Sem etapa nova de infra.** Worker, Firestore, Hosting já provisionados.

## Etapa 2 — Geração do snippet

**Quem:** admin gera, cliente cola.
**Onde:** nova aba "Rastreamento" dentro da página do cliente no admin.

Tela mostra:

```html
<!-- Cole no <head> do site, antes de qualquer outro script -->
<script async src="https://track.menudino.com/track.js?t=marieta-bistro"></script>
```

Botão **"Copiar"**. Botão **"Testar instalação"** (faz fetch do site cliente, busca string `track.js?t={slug}`, retorna OK/falhou).

Param `?t=` redundante com `Origin` — Worker valida ambos batem.

## Etapa 3 — Instalação no site cliente

Três cenários, doc por cenário em `INTEGRACAO_LEADS.md`:

| Stack cliente | Onde colar |
|---------------|------------|
| HTML estático (GitHub Pages, Netlify) | `<head>` do `index.html` |
| WordPress | Plugin "Insert Headers and Footers" → Header |
| Wix/Squarespace | Settings → Custom Code → Header |
| Site feito por você (Menudino) | Já vem embutido por padrão via `tenantConfig.leadTracking.enabled` |

**Sites já hospedados por você** (marieta-bistro, academia-olimpus, pizza-kid, etc — listados em `TENANTS_FALLBACK`): injeção automática no template, cliente nem vê. Zero ação dele.

## Etapa 4 — Configuração de campanhas Ads

Cliente (ou agência dele) precisa marcar URLs de destino com UTMs. Doc enxuta + builder no admin:

**Builder UTM** (nova aba "Gerador de Link" dentro de Rastreamento):

```
URL base:        [https://marietabistro.com.br]
Source:          [google ▼]   (instagram, facebook, tiktok, email, ...)
Medium:          [cpc ▼]      (organic, social, email, ...)
Campaign:        [black-friday-2026]
Content (opc):   [anuncio-pizza-margherita]

→ https://marietabistro.com.br?utm_source=google&utm_medium=cpc&utm_campaign=black-friday-2026&utm_content=anuncio-pizza-margherita
[Copiar]
```

`gclid`/`fbclid` automáticos — Google Ads e Meta injetam sozinho quando "Auto-tagging" ligado. Doc instrui cliente a:

1. Google Ads → Configurações da conta → Acompanhamento automático ✓
2. Meta Ads Manager → Configurações da Conta → Tags de URL ✓

## Etapa 5 — Validação (handshake)

Antes de declarar "instalado":

1. **Smoke test automático** (botão no admin):
   - Worker faz `fetch(siteCliente)`, parseia HTML, verifica presença do `<script>` correto
   - Retorna verde/vermelho na UI

2. **Lead-teste manual**:
   - Admin abre `https://siteCliente?utm_source=teste-instalacao&utm_medium=manual`
   - Clica WhatsApp do site
   - Painel mostra lead novo em <5s com `source: teste-instalacao`
   - Botão "Marcar instalação como verificada"

3. **Status na lista de clientes**: badge verde "Tracking ativo · último lead há X min" / amarelo "Sem leads há 7d" / vermelho "Script não detectado".

## Etapa 6 — Operação contínua

**Pro cliente:**

- Acessa `c-admin → Relatório de Leads`
- Vê CPL por campanha (depois de informar gasto manualmente — campo simples por mês/campanha na v1)
- Exporta CSV pra cruzar com Meta/Google Ads dele

**Pra você:**

- Cron diário (GitHub Action já existe em `.github/workflows`) checa health de cada tenant. Sem leads + sem visitas há 7d → notifica via WhatsApp/email
- Relatório agregado mensal: quantos tenants ativos, leads totais, ticket médio (cliente paga + R$X/mês pelo módulo)

## Etapa 7 — Suporte e troubleshooting

Doc `TROUBLESHOOTING_LEADS.md` cobrindo:

| Sintoma | Causa provável | Fix |
|---------|----------------|-----|
| "Não aparecem leads" | Script não carregou | Verificar Network tab, confirmar `?t=` correto |
| "Leads sem origem" | Cliente entrou direto | Esperado — categoriza como "direto" |
| "UTM perdido após redirect" | Site cliente faz redirect 301/302 | Adicionar query forwarding no redirect |
| "Adblock bloqueia" | uBlock detecta domínio tracker | v2: servir via Worker route no domínio do cliente |
| "Lead duplicado no clique duplo" | Sem debounce | `track.js` faz dedup 2s por sessionId+type |

## Etapa 8 — Pacote comercial

Sugestão de oferta (não-técnico, alimenta o pitch):

- **Grátis** — incluído em qualquer plano c-admin existente. Atrito zero pra fechar venda.
- **OU Premium R$X/mês** — desbloqueia: integração Meta/Google Ads API (custo automático), alertas WhatsApp por lead novo, multi-touch attribution. v2.

## Cronograma de rollout

| Semana | Entrega |
|--------|---------|
| 1 | Worker `/lead` + `track.js` + Firestore schema. Smoke local OK. |
| 2 | `RelatorioLeadsPage` + builder UTM + validação no admin. |
| 3 | Piloto em 1 tenant (sugestão: marieta-bistro — você controla site). Coleta dados reais 5 dias. |
| 4 | Ajustes do piloto + rollout pros 7 tenants atuais. Doc pública pronta. |
| 5+ | Onboarding cliente novo: ~30min do tempo seu por cliente (cadastro + geração snippet + validação). |

## Dependências externas

- **Cloudflare Worker** — já configurado (`worker/wrangler.toml`)
- **Firebase Service Account** — já configurado (secret no Worker)
- **Domínio `track.menudino.com`** — opcional, pode rodar em `clientes-sync.{conta}.workers.dev`
- **Nenhuma API paga** na v1

## Critério de "integração concluída" por tenant

Checklist gravado em `tenantConfig.leadTracking`:

```js
{
  enabled: true,
  installedAt: Timestamp,
  smokeTestPassed: true,
  manualTestLead: 'leadId-de-referencia',
  verifiedBy: 'admin-uid',
  firstRealLeadAt: Timestamp | null
}
```

Tenant só aparece como "Tracking ativo" no dashboard quando todos campos preenchidos.

