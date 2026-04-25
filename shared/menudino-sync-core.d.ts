// Type definitions para shared/menudino-sync-core.js

export interface MenudinoCategory {
  id: string;
  name: string;
  sortIndex?: number;
}

export interface MenudinoItem {
  name: string;
  description?: string;
  salePrice?: number;
  hasPhoto?: boolean;
  largeImageUrl?: string;
  smallImageUrl?: string;
  sortIndex?: number;
}

export interface MenudinoMerchant {
  name?: string;
  phone?: string;
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  openingHours?: Array<{ dayOfWeek: string; startTime: string; endTime: string }>;
}

export interface CardapioItem {
  nome: string;
  desc: string;
  preco: number;
  imagem: string;
  ativo: boolean;
  tags: string[];
}

export interface CardapioCategoria {
  titulo: string;
  nota: string;
  ativo: boolean;
  itens: CardapioItem[];
}

export interface CardapioAba {
  id: string;
  label: string;
  ativo: boolean;
  categorias: CardapioCategoria[];
}

export interface BusinessInfo {
  name: string;
  slogan: string;
  tagline: string;
  whatsapp: string;
  whatsappNumber: string;
  phone: string;
  address: string;
  neighborhood: string;
  cityState: string;
  cep: string;
  instagram: string;
  facebook: string;
  googleMapsLink: string;
  googleMapsEmbed: string;
  hours: { funcionamento: string; almoco: string; jantar: string; completo: string };
}

export interface MergeStats {
  adicionados: number;
  atualizados: number;
  inativados: number;
  preservados_desc: number;
  preservados_imagem: number;
  categorias_novas: number;
  categorias_movidas: number;
}

export function converterMenudino(
  categories: MenudinoCategory[],
  itemsByCategoryId: Record<string, MenudinoItem[]>
): CardapioAba[];

export function converterBusinessInfo(merchant: MenudinoMerchant): BusinessInfo;

export function mergeBusinessInfo(atual: BusinessInfo | null, novo: BusinessInfo): BusinessInfo;

export function mergeCardapio(
  atual: CardapioAba[] | null,
  novo: CardapioAba[]
): { cardapio: CardapioAba[]; stats: MergeStats };
