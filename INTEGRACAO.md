# Guia de Integração — Cardápio Admin

Este documento descreve a arquitetura completa da plataforma **Cardápio Admin** e como sites clientes se conectam a ela. Serve também como contexto de referência para futuras implementações com IA.

---

## 1. Visão Geral da Plataforma

**Cardápio Admin** (`C:/dev/cardapio-admin`) é um painel React/Vite que gerencia dados de múltiplos clientes no Firebase. Sites clientes (ex: `C:/dev/clientes/marieta`) consomem esses dados via API REST pública do Firestore.

### Stack
- Admin: React 19 + Vite 8 + Tailwind CSS 4 + Firebase SDK
- Site cliente: HTML5 puro (sem framework), CSS vanilla, JavaScript vanilla
- Banco: Firestore (projeto `cardapio-admin-prod`)
- Auth admin: Firebase Auth (autenticação de usuários do painel)

---

## 2. Estrutura no Firestore

Cada cliente tem um **slug** único (ex: `marieta-bistro`). Todos os dados ficam em:

```
restaurants/{slug}/data/{documento}
```

| Documento       | Conteúdo                                         |
|-----------------|--------------------------------------------------|
| `cardapio`      | Cardápio (abas, categorias, itens)               |
| `promocoes`     | Promoções por dia da semana                      |
| `businessInfo`  | Endereço, telefone, horários, redes sociais      |

Todos os documentos têm o formato:
```json
{
  "content": { ... },
  "updatedAt": "2026-04-13T..."
}
```

---

## 3. Projeto Firebase

- **Produção**: `cardapio-admin-prod`
- **Dev/Staging**: `clientes-admin-a2258`

URL base da API REST:
```
https://firestore.googleapis.com/v1/projects/cardapio-admin-prod/databases/(default)/documents/restaurants/{slug}/data/
```

Os documentos são **públicos para leitura** (sem autenticação).

---

## 4. Como buscar os dados (JavaScript puro)

```html
<script>
  var SLUG = 'marieta-bistro';
  var PROJECT = 'cardapio-admin-prod';
  var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT
           + '/databases/(default)/documents/restaurants/' + SLUG + '/data/';

  // Parser do formato Firestore REST
  function parseFirestoreValue(val) {
    if (val.stringValue  !== undefined) return val.stringValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.doubleValue  !== undefined) return val.doubleValue;
    if (val.nullValue    !== undefined) return null;
    if (val.arrayValue)  return (val.arrayValue.values || []).map(parseFirestoreValue);
    if (val.mapValue) {
      var obj = {}, fields = val.mapValue.fields || {};
      for (var k in fields) obj[k] = parseFirestoreValue(fields[k]);
      return obj;
    }
    return val;
  }

  function fetchFirestore(docName) {
    return fetch(BASE + docName)
      .then(function(r) { return r.json(); })
      .then(function(doc) {
        if (doc.fields && doc.fields.content) {
          return parseFirestoreValue(doc.fields.content);
        }
        return null;
      });
  }

  var isLocal = location.protocol === 'file:';

  if (!isLocal) {
    fetchFirestore('cardapio')
      .then(function(data) { iniciarCardapio(data || cardapioData); })
      .catch(function() { iniciarCardapio(cardapioData); });

    fetchFirestore('businessInfo')
      .then(function(data) { aplicarBusinessInfo(data); })
      .catch(function() {});

    fetchFirestore('promocoes')
      .then(function(data) { if (data) renderPromocoes(data); else renderPromocoes(promocoesData); })
      .catch(function() { renderPromocoes(promocoesData); });
  } else {
    iniciarCardapio(cardapioData);
    renderPromocoes(promocoesData);
  }
</script>
```

---

## 5. Estrutura de cada documento

### 5.1 `cardapio`

```js
[
  {
    id: "cardapio",          // slug gerado do label
    label: "Cardápio",       // nome da aba
    ativo: true,             // false = aba inteira oculta no site
    categorias: [
      {
        titulo: "Entradas",
        nota: "Observação opcional (ex: *consulte o garçom)",
        ativo: true,         // false = categoria inteira oculta no site
        itens: [
          {
            nome: "Nome do prato",
            desc: "Descrição do prato",   // pode ser vazio
            preco: 45.00,                 // null = ocultar preço
            imagem: "https://...",        // URL da imagem (pode ser vazio)
            ativo: true,                  // false = não exibir no site
            tags: ["vegetariano", "sem-gluten"]  // array de strings (pode ser vazio)
          }
        ]
      }
    ]
  }
]
```

**Regras de renderização:**
- Ignorar itens onde `ativo === false`
- Ignorar categorias onde `ativo === false`
- `preco === null` ou `preco === 0` = não exibir preço
- `imagem` pode ser string vazia — usar placeholder
- `tags` disponíveis: `destaque`, `vegetariano`, `vegano`, `sem-gluten`, `picante`, `novo`, `favorito-chef`

**Tag `destaque`:**
- No admin: ao marcar um item como destaque, ele é movido automaticamente para o início da categoria
- No site cliente: itens com `tags.includes('destaque')` (ou `item.destaque === true` legado) devem aparecer antes dos demais dentro de cada categoria
- Detecção: `item.destaque === true || (Array.isArray(item.tags) && item.tags.includes('destaque'))`
- Ordenação: `itens.sort((a, b) => isDestaque(b) - isDestaque(a))` — estável, mantém ordem relativa entre os destaques e entre os não-destaques

### 5.2 `promocoes`

```js
{
  domingo:  [ { texto: "Promoção X", destaque: true } ],
  segunda:  [],
  terca:    [ { texto: "Promoção Y", destaque: false } ],
  quarta:   [],
  quinta:   [],
  sexta:    [],
  sabado:   []
}
```

Para exibir: leia a chave do dia atual (`new Date().getDay()` → 0=domingo, 6=sábado).

### 5.3 `businessInfo`

```js
{
  name: "Marieta Bistrô",
  city: "Taquaritinga - SP",
  slogan: "Gastronomia autoral em um casarão centenário",
  tagline: "",
  whatsapp: "(16) 98148-8080",         // para exibição
  whatsappNumber: "5516981488080",      // para links wa.me/{número}
  phone: "(16) 98148-8080",
  address: "Rua General Glicério, 142",
  neighborhood: "Centro",
  cityState: "Taquaritinga — SP",
  cep: "15900-045",
  instagram: "https://www.instagram.com/marieta_bistro",
  facebook: "",
  googleMapsLink: "https://www.google.com/maps/...",
  googleMapsEmbed: "https://www.google.com/maps?q=...&output=embed",
  hours: {
    funcionamento: "Terça a Domingo",
    jantar: "19h30 às 23h",
    almoco: "Sáb 11h · Dom 11h30",
    completo: "Ter a Sex 19h30–23h · Sáb 11h–14h / 19h30–23h30 · Dom 11h30–14h"
  }
}
```

---

## 6. IDs de elementos no site cliente

> **Observação:** cada site cliente tem sua própria tabela de IDs de DOM mapeados por `aplicarBusinessInfo`. A tabela abaixo é do **Marieta**. Para outros clientes, consulte a função correspondente no repositório do site (ex.: Pizza Kid → `C:/dev/prototipos/pizza kid/scripts/main.js:aplicarBusinessInfo`).

### 6.1 Marieta Bistrô — IDs

A função `aplicarBusinessInfo(info)` atualiza os seguintes elementos do DOM:

| ID do elemento          | O que atualiza                                         |
|-------------------------|--------------------------------------------------------|
| `header-wa-link`        | Link "Reservar" no nav                                 |
| `hero-wa-link`          | Link "reserve sua mesa" no hero                        |
| `exp-reserve-btn`       | Botão CTA na seção Experiência                         |
| `exp-funcionamento`     | Texto dos dias de funcionamento                        |
| `exp-jantar`            | Horário jantar                                         |
| `exp-almoco`            | Horário almoço                                         |
| `contact-address`       | Endereço completo (innerHTML com `<br>`)               |
| `contact-phone`         | Link de telefone (href + textContent)                  |
| `contact-hours`         | Horário completo                                       |
| `contact-whatsapp-link` | Link WhatsApp no bloco de contato                      |
| `contact-instagram-link`| Link Instagram                                         |
| `contact-maps-link`     | Link "Abrir no Mapa"                                   |
| `contactMap`            | innerHTML com `<iframe>` do embed do mapa              |
| `event-wa-1`            | Link WhatsApp — jantares corporativos                  |
| `event-wa-2`            | Link WhatsApp — aniversários e comemorações            |
| `event-wa-3`            | Link WhatsApp — eventos privados                       |
| `whatsapp-float-link`   | Link WhatsApp no footer (ícone social)                 |
| `wa-float-btn`          | Botão flutuante verde do WhatsApp                      |
| `footer-phone-link`     | Link de telefone no footer                             |
| `footer-address-link`   | Link do endereço no footer                             |

**Regra:** ao adicionar qualquer novo link de WhatsApp, telefone, endereço ou mapa no HTML, sempre adicionar um `id` e registrar aqui. A função `aplicarBusinessInfo` deve ser atualizada para cobri-lo.

---

## 7. Admin — CardapioEditor (`src/pages/CardapioEditor.jsx`)

### Funcionalidades implementadas
- **Abas**: drag & drop para reordenar, adicionar, renomear, deletar
- **Categorias**: drag & drop dentro da aba, adicionar, renomear, deletar, **inativar/ativar**
- **Itens**: drag & drop dentro da categoria, adicionar, editar, duplicar, **inativar/ativar**, deletar
- **Busca**: campo de busca filtra itens em todas as abas/categorias simultaneamente
- **Tags**: chips toggleáveis por item — **destaque** (⭐, move para o topo da categoria), vegetariano, vegano, sem glúten, picante, novo, favorito do chef
- **Contador**: header da categoria exibe `{X} ativos · {Y} inativos`
- **Aviso de não salvo**: indicador "Não salvo" + `beforeunload` ao fechar aba com alterações
- **Deleção segura**: modal de confirmação com opção de inativar em vez de deletar

### Modal de deleção de item
Aparece ao clicar no ícone de lixeira. Oferece:
1. "Inativar" — mantém o item, muda `ativo: false`
2. "Deletar permanentemente" — remove o item do array

### Inativação de categoria
Botão de olho no header da categoria. Ao inativar:
- `categoria.ativo = false` salvo no Firestore
- No site cliente: categoria inteira é ocultada (todos os itens, mesmo que individuais estejam ativos)
- O modal oferece a mesma escolha: inativar vs. deletar permanentemente

---

## 8. Admin — BusinessInfoEditor (`src/pages/BusinessInfoEditor.jsx`)

Gerencia `businessInfo` no Firestore. Campos disponíveis:
- Nome, cidade, slogan, tagline
- WhatsApp (exibição + número API), telefone
- Endereço, bairro, cidade-UF, CEP
- Horários: funcionamento, jantar, almoço, completo
- Instagram, Facebook
- Google Maps link + embed

---

## 9. Regras de Segurança Firestore (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /restaurants/{slug} {
      allow read: if true;
      allow write: if request.auth != null;
      match /data/{docId} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Deploy para produção:
```bash
firebase deploy --only firestore:rules --project cardapio-admin-prod
```

---

## 10. Boas práticas para o site cliente

### Fallback local
```js
var isLocal = location.protocol === 'file:';
if (!isLocal) {
  fetchFirestore('cardapio')
    .then(function(data) { renderCardapio(data || dadosLocais); })
    .catch(function() { renderCardapio(dadosLocais); });
} else {
  renderCardapio(dadosLocais);
}
```

### Filtrar inativos + ordenar destaques
```js
function isDestaque(item) {
  return item.destaque === true || (Array.isArray(item.tags) && item.tags.indexOf('destaque') !== -1);
}

tabs.forEach(function(tab) {
  if (tab.ativo === false) return;
  tab.categorias.forEach(function(cat) {
    if (cat.ativo === false) return;
    var itens = cat.itens.filter(function(item) { return item.ativo !== false; });
    itens.sort(function(a, b) { return (isDestaque(b) ? 1 : 0) - (isDestaque(a) ? 1 : 0); });
    itens.forEach(function(item) {
      // ... renderiza
    });
  });
});
```

### Formatar preço
```js
function formatarPreco(preco) {
  if (preco === null || preco === undefined || preco === 0) return null;
  var p = Number(preco);
  return 'R$ ' + (p % 1 === 0 ? p + ',00' : p.toFixed(2).replace('.', ','));
}
```

### Link WhatsApp dinâmico
```js
var waUrl = 'https://wa.me/' + info.whatsappNumber
          + '?text=' + encodeURIComponent('Olá! Gostaria de mais informações.');
document.getElementById('btn-whatsapp').href = waUrl;
```

### Mapa embed
```html
<div id="contactMap"></div>
<script>
  if (info.googleMapsEmbed) {
    document.getElementById('contactMap').innerHTML =
      '<iframe src="' + info.googleMapsEmbed + '" width="100%" height="400" style="border:0" allowfullscreen loading="lazy"></iframe>';
  }
</script>
```

---

## 11. Checklist de integração (novo cliente)

- [ ] Definir o `slug` do cliente no admin
- [ ] Usar projeto Firebase de produção: `cardapio-admin-prod`
- [ ] Implementar `parseFirestoreValue()` para converter formato da API REST
- [ ] Buscar e renderizar `cardapio` — respeitar `ativo === false` em abas, categorias e itens; ordenar destaques primeiro por categoria
- [ ] Buscar e aplicar `businessInfo` — todos os IDs mapeados na tabela da seção 6
- [ ] Buscar e exibir `promocoes` — filtrar pelo dia atual
- [ ] Implementar fallback com dados locais
- [ ] Não bloquear renderização enquanto aguarda o Firestore
- [ ] Garantir que qualquer link de WhatsApp/telefone/mapa tenha `id` e seja coberto por `aplicarBusinessInfo`

---

## 12. Clientes integrados

| Slug                        | Nome                     | URL produção                                 | Integrado em | Particularidades                                                                 |
|-----------------------------|--------------------------|----------------------------------------------|--------------|----------------------------------------------------------------------------------|
| `marieta-bistro`            | Marieta Bistrô           | (menudino + site próprio)                    | 2026-04-03   | Inclui doc `instagram` com grid de posts renderizado via `renderInstagramGrid()` |
| `pizza-kid`                 | Pizza Kid Taquaritinga   | https://www.pizzakidtaquaritinga.com.br      | 2026-04-17   | Cardápio tem campo `divisao` por aba (pizzas meio-a-meio); cache localStorage SWR |
| `imperium-moda-social`      | Imperium Moda Social     | —                                            | 2026-04-14   | Não é restaurante; usa coleção `products` em vez de `cardapio`                    |
| `casa-de-carnes-mais-sabor` | Casa de Carnes M. Sabor  | (menudino)                                   | 2026-04-14   | Sem site próprio; redirect para menudino                                          |

Ao integrar um novo cliente, adicione uma linha nesta tabela com o que for não-trivial para futuros mantenedores.

---

## 13. Campos opcionais por cliente

Além do schema base (seção 5), os clientes podem estender os documentos conforme necessário. Padrões observados:

### 13.1 `cardapio` — campo `divisao` (Pizza Kid)
Abas de pizzaria podem declarar em quantas fatias a pizza é dividida, para permitir combinação meio-a-meio:
```js
{ id: "pizza-bigtrem", label: "Pizza Bigtrem", ativo: true, divisao: 8, categorias: [...] }
```
Default implícito: `8`. Se o site cliente não usa meio-a-meio, simplesmente ignore o campo.

### 13.2 `cardapio` — tags livres
`item.tags` é um array de strings. As tags oficiais (seção 5.1) têm efeito visual/ordenação no admin. Tags não-oficiais são preservadas e podem ser usadas pelo site para filtros próprios (ex.: `"picante-leve"`, `"lancamento-2026"`).

### 13.3 `businessInfo` — `hours.completo` como fonte única
Recomenda-se que o site cliente derive o badge "aberto/fechado" a partir de `hours.completo`, parseando strings como `"Seg 17h-23h | Ter-Sab 17h30-23h30 | Dom 17h30-23h30"`. Implementação de referência em `C:/dev/prototipos/pizza kid/scripts/main.js` (função `parseBusinessHours` + `isOpenNow` + `refreshOpenStatus`).

---

## 14. Cache localStorage no site cliente (recomendado)

Padrão **stale-while-revalidate** adotado no Pizza Kid (`C:/dev/prototipos/pizza kid/data/firestore.js`):

1. Ao carregar, ler o cache em `localStorage` e renderizar imediatamente (mesmo que esteja velho até o TTL).
2. Em paralelo, fazer o fetch do Firestore.
3. Quando responder, gravar no cache e chamar a função de render novamente (re-render é idempotente porque todos os setters só atualizam o DOM se `info` existe).

```js
var TTL_HOUR = 60 * 60 * 1000;
var CACHE_KEYS = {
  cardapio: 'pk_menu_cache_v1',
  businessInfo: 'pk_business_cache_v1',
  promocoes: 'pk_promos_cache_v1'
};
function cacheGet(key, ttl) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || (Date.now() - obj.t) > ttl) return null;
    return obj.d;
  } catch(e) { return null; }
}
function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch(e) {}
}
```

**Benefícios:** tempo-para-primeira-renderização ~0ms mesmo em 3G, economia de leituras no Firestore.

**Invalidação manual:** peça ao cliente rodar `localStorage.clear()` (ou bump do `_v1` → `_v2` no código) quando fizer alteração urgente no admin e quiser ver refletido antes do TTL.

---

## 15. Seed inicial via script (alternativa ao admin UI)

Para popular os documentos de um novo cliente sem preencher campo a campo no admin, use `firebase-admin` + `serviceAccountProd.json`. Referência: `C:/dev/prototipos/pizza kid/scripts/seed-firestore.js` — roda num contexto `vm` sobre os fallbacks locais (`data/site.js`, `data/menu.js`) e grava em `restaurants/{slug}/data/{businessInfo,cardapio,promocoes}` com `updatedAt` em ISO string.

Uso:
```bash
cd C:/dev/prototipos/pizza-kid
node scripts/seed-firestore.js
```

Importante:
- Nunca commitar `serviceAccountProd.json` (já está no `.gitignore` do admin).
- Depois do seed, a edição passa a ser feita no painel admin — evitar rerodar o seed sem necessidade (sobrescreve o que o cliente editou).
