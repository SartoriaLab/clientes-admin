# Integração de Rastreamento de Leads

Como instalar o script de rastreamento no site do cliente e configurar campanhas Ads.

---

## 1. Snippet de instalação

Cole **no `<head>`** do site, antes de qualquer outro script:

```html
<!-- Rastreamento de leads — substitua SLUG pelo identificador do cliente -->
<script async
  src="https://clientes-sync.workers.dev/track.js?t=SLUG"
  data-worker="https://clientes-sync.workers.dev">
</script>
```

Substitua `SLUG` pelo identificador do cliente (ex: `marieta-bistro`, `pizza-kid`).

### Por plataforma

| Plataforma | Onde colar |
|------------|------------|
| HTML estático (GitHub Pages, Netlify) | `<head>` do `index.html` |
| WordPress | Plugin "Insert Headers and Footers" → Header |
| Wix | Configurações → Custom Code → Head |
| Squarespace | Settings → Advanced → Code Injection → Header |
| Sites gerenciados por você | Já incluído via template (configure `leadTracking.enabled: true` no `tenantConfig`) |

---

## 2. O que o script rastreia

- **UTMs**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- **Clids automáticos**: `gclid` (Google Ads) e `fbclid` (Meta Ads)
- **Referrer HTTP**: domínio de origem na primeira visita
- **Página de entrada** (sem query string)
- **Tipo de conversão**: clique em WhatsApp, clique em telefone

Atribuição **first-touch**: os parâmetros são armazenados em `localStorage` por 30 dias. Só são sobrescritos se o visitante chegar com novos UTMs.

---

## 3. Eventos capturados

| Evento | Dispara quando |
|--------|----------------|
| `whatsapp_click` | Visitante clica em link `wa.me/` ou `api.whatsapp.com` |
| `phone_click` | Visitante clica em link `tel:` |
| `form_submit` | (Futuro v2) Formulário de contato enviado |

---

## 4. URLs com UTM para campanhas

### Google Ads
1. Nas configurações da conta: **Acompanhamento automático** ✓  
   O `gclid` é injetado automaticamente em todos os anúncios.

2. Opcionalmente, adicione UTMs manuais na URL de destino:
   ```
   https://marietabistro.com.br?utm_source=google&utm_medium=cpc&utm_campaign=NOME_DA_CAMPANHA
   ```

### Meta Ads (Facebook / Instagram)
1. No Gerenciador de Anúncios → Configurações da Conta → **Tags de URL** ✓  
   O `fbclid` é injetado automaticamente.

2. No campo "URL do site" do anúncio, use UTMs:
   ```
   https://marietabistro.com.br?utm_source=instagram&utm_medium=paid_social&utm_campaign=NOME_DA_CAMPANHA
   ```

### Gerador de URL

Monte a URL manualmente:
```
URL base: https://marietabistro.com.br
utm_source:   google | instagram | facebook | tiktok | email
utm_medium:   cpc | paid_social | organic | email
utm_campaign: nome-da-campanha
utm_content:  (opcional) variação do anúncio
```

Exemplo completo:
```
https://marietabistro.com.br?utm_source=google&utm_medium=cpc&utm_campaign=black-friday-2026&utm_content=anuncio-pizza-margherita
```

---

## 5. Verificação da instalação

### Smoke test manual
1. Abra o site com UTMs de teste:
   ```
   https://siteCliente.com.br?utm_source=teste-instalacao&utm_medium=manual
   ```
2. Abra o DevTools → Network, filtre por `track.js` — deve aparecer com status 200.
3. Clique no link de WhatsApp do site.
4. No painel admin → Leads → deve aparecer um lead com `source: teste-instalacao` em poucos segundos.

### Verificar localStorage
No console do browser:
```js
JSON.parse(localStorage.getItem('_cd'))
// → { source: "teste-instalacao", medium: "manual", landingPage: "...", referrer: "", exp: ... }
```

---

## 6. Troubleshooting

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Script não aparece no Network | Snippet não instalado ou erro de SLUG | Verificar `<head>` e SLUG correto |
| Leads sem origem (`source: direct`) | Visitante chegou direto, sem UTM | Esperado — configure campanhas com UTMs |
| UTM sumiu após redirect | Site faz redirect 301/302 sem repassar query | Configurar forwarding de query no redirect |
| Adblocker bloqueando | uBlock detecta domínio externo | Mitigação v2: servir script via Worker no domínio do cliente |
| Leads duplicados | Duplo clique rápido | Dedup de 2s já implementado — ignorar |
| `track.js` não carrega | SLUG inválido ou Worker fora do ar | Verificar URL do Worker e SLUG no tenantConfig |
