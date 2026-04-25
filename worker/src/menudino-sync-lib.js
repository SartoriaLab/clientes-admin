// Re-export do core compartilhado. Fonte única em /shared/menudino-sync-core.js.
// Worker bundle (esbuild via wrangler) inline esse import.
export {
  converterMenudino,
  converterBusinessInfo,
  mergeBusinessInfo,
  mergeCardapio
} from '../../shared/menudino-sync-core.js';
