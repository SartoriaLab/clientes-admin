# Scripts admin

Scripts one-off de manutenção. **Todos exigem service account JSON local** (não commitado — ver `.gitignore`).

## Service account

1. Baixar do Firebase Console → Project Settings → Service Accounts → Generate new private key.
2. Salvar como `serviceAccountDev.json` ou `serviceAccountProd.json` na raiz do repo.
3. **Nunca commitar.** `.gitignore` cobre `serviceAccount*.json`.
4. Rotacionar a chave a cada 90 dias ou após qualquer suspeita de vazamento (Console → Service Accounts → Delete + Generate).

## Scripts disponíveis

| Script | Propósito | Ambiente |
|---|---|---|
| `migrate.js` | Migração DEV → PROD de coleções | dev + prod |
| `seed-imperium.js` | Seed inicial do tenant `imperium` | dev |
| `setAdminUser.js` | Promove user para `role=admin` | prod |
| `scripts/seed-admin.mjs` | Cria primeiro admin user | qualquer |
| `scripts/seed-precos.mjs` | Seed de preços iniciais | dev |
| `scripts/seed-veiculos.mjs` | Seed de veículos | dev |
| `scripts/migrate-types.mjs` | Migração de tipos de doc | qualquer |

## Boas práticas

- **Audit trail**: todo run deve ser logado manualmente (data, autor, comando, resultado).
- **Idempotência**: rodar 2× não deve quebrar dados. Verifique o script antes.
- **Backup antes de PROD**: `gcloud firestore export gs://<backup-bucket>` antes de `migrate.js` ou `setAdminUser.js`.
- **Considerar Cloud Functions**: scripts críticos (mudança de role, migração de schema) deveriam virar Functions com triggers de Auth ou callable, eliminando uso de service account local.

## TODO

- [ ] Migrar `setAdminUser.js` → Cloud Function HTTP callable com check de claim.
- [ ] Adicionar dry-run flag em `migrate.js`.
- [ ] Remover credenciais hardcoded de `seed-imperium.js` (usar `.env`).
