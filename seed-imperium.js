import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD7ImWnSeSb3DTuyXTnS55gRsqkBZZv5q8",
  authDomain: "clientes-admin-a2258.firebaseapp.com",
  projectId: "clientes-admin-a2258",
  storageBucket: "clientes-admin-a2258.firebasestorage.app",
  messagingSenderId: "598293541730",
  appId: "1:598293541730:web:bdee1e314b46e5fa9ff23b"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const SLUG = 'imperium-moda-social'

const products = [
  { id: 'camisa-social-azul-marinho', nome: 'Camisa Social Azul Marinho levemente Acetinada', descricao: 'Super fácil de passar, não amassa durante o uso, sensação de frescor, antialérgica, toque macio, colarinho estruturado, não desbota, não encolhe/alarga pós lavagem. QUALIDADE SUPER PREMIUM.', preco: 229.90, categoria: 'camisas-sociais', destaque: false, observacoes: '', images: [] },
  { id: 'camisa-social-slim-branca-bambu', nome: 'Camisa Social Slim Branca (Fibra Natural de Bambu)', descricao: 'Tecido fresco, não amarrota durante o uso e super fácil de passar.', preco: 229.90, categoria: 'camisas-sociais', destaque: false, observacoes: '', images: [] },
  { id: 'camisa-social-branca-passa-facil', nome: 'Camisa Social sem bolso Branca (Passa fácil e não Amassa)', descricao: 'Fibra Natural de Bambu com Elástano. Tecnologia passa fácil, toque macio, sensação térmica agradável, antialérgica, manga longa s/ bolso, colarinho italiano (ideal p/ gravatas).', preco: 229.90, categoria: 'camisas-sociais', destaque: false, observacoes: 'Consulte disponibilidade de cores', images: [] },
  { id: 'camisa-social-slim-vivacci', nome: 'Camisas Social Slim Fit Vivacci (passa fácil e não amarrota)', descricao: 'Levemente acetinada ou fibra natural de bambu. Super fácil de passar, tecido leve e respirável, toque macio, antialérgica, caimento perfeito, colarinho estruturado, não desbota, não encolhe/alarga. Qualidade Super Premium.', preco: 229.90, categoria: 'camisas-sociais', destaque: false, observacoes: 'Consultar disponibilidade', images: [] },
  { id: 'cinto-dupla-face', nome: 'Cinto dupla face (Preto/Marrom)', descricao: 'Super versátil e elegante, qualidade e acabamento premium. Material: Sintético.', preco: 49.90, categoria: 'acessorios', destaque: false, observacoes: '', images: [] },
  { id: 'cintos-trava-automatica', nome: 'Cintos trava automática Premium', descricao: 'Trava automática ajustável, super elegante e prático, qualidade e acabamento perfeito.', preco: 129.90, categoria: 'acessorios', destaque: false, observacoes: '', images: [] },
  { id: 'costume-two-way-elastano', nome: 'Costume Two Way com elastano', descricao: 'Costume Two Way com elastano.', preco: 599.90, categoria: 'ternos-costumes', destaque: false, observacoes: 'Consulte disponibilidade de tamanhos e cores', images: [] },
  { id: 'bermudas-alfaiataria', nome: 'Bermudas alfaiataria', descricao: 'Diversas opções de cores e tecidos.', preco: 169.90, categoria: 'calcas-bermudas', destaque: false, observacoes: 'Consulte disponibilidade de cores e tamanhos', images: [] },
  { id: 'calcas-jeans', nome: 'Calças Jeans (Disponível do 38 ao 48)', descricao: 'Calças Jeans.', preco: 179.90, categoria: 'calcas-bermudas', destaque: false, observacoes: 'Consulte disponibilidade', images: [] },
  { id: 'camisa-social-elastic-sibra', nome: 'Camisa social tecnológica Elastic Sibra', descricao: 'Não precisa passar, não amarrota durante o uso, ultra elástica, antialérgica, antiodor, toque macio, tecido natural e ecológico, respirável, leve e fresquinha.', preco: 249.90, categoria: 'camisas-sociais', destaque: false, observacoes: '', images: [] },
  { id: 'jaqueta-sarja-premium', nome: 'Jaqueta Sarja Premium', descricao: 'Jaqueta em Sarja. Tamanho P ao GG. Cores: Verde militar, Preto. Composição: Algodão com elastano.', preco: null, categoria: 'jaquetas-sueteres', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'calcas-alfaiataria-regulagem', nome: 'Calças Alfaiataria com regulagem', descricao: 'Calças alfaiataria em malha com regulagem. Caimento impecável, conforto inigualável, praticidade, elegância e autoridade. Enviamos para todo Brasil.', preco: null, categoria: 'calcas-bermudas', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'tshirts-basicas', nome: 'T-shirts básicas diversas cores', descricao: 'Camisetas básicas em várias opções de cores, caimento sensacional e conforto extremo.', preco: null, categoria: 'camisetas-polos', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'sueter-premium', nome: 'Suéter Premium', descricao: 'Toque macio, caimento perfeito. Tamanhos: P ao EG. Cores: Preto, Cinza, Marinho, Marrom caramelo. Composição: Modal/Poliéster/Nylon.', preco: null, categoria: 'jaquetas-sueteres', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'perfumes-pronta-entrega', nome: 'Perfumes a pronta entrega', descricao: 'Mesma linhagem olfativa dos importados, muita fixação e fragrâncias irresistíveis.', preco: 159.90, categoria: 'perfumes', destaque: false, observacoes: '', images: [] },
  { id: 'camisas-polo-vivacci', nome: 'Camisas Polo Vivacci P ao G1', descricao: 'Toque macio, confortável, caimento perfeito, resistente a rugas, fácil de passar. Disponível do P ao GG.', preco: 149.90, categoria: 'camisetas-polos', destaque: false, observacoes: 'Consultar disponibilidade de cores e tamanhos', images: [] },
  { id: 'ternos-poliviscose-slim', nome: 'Ternos Poliviscose Slim Italiano', descricao: 'Diversos modelos.', preco: 799.90, categoria: 'ternos-costumes', destaque: false, observacoes: 'Consulte lançamentos e disponibilidade', images: [] },
  { id: 'calcas-alfaiataria-38-52', nome: 'Calças alfaiataria (disponível do 38 ao 52)', descricao: 'Calças alfaiataria.', preco: null, categoria: 'calcas-bermudas', destaque: false, observacoes: 'Consulte disponibilidade', images: [] },
  { id: 'gravatas-variedade', nome: 'Variedade em Gravatas', descricao: 'Vários modelos para todas as ocasiões: eventos religiosos, casamentos, formaturas, apresentações e trabalhos.', preco: null, categoria: 'acessorios', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'looks-combinacoes', nome: 'Looks, Combinações e Conjuntos', descricao: 'Opções de looks, combinações e conjuntos disponíveis.', preco: null, categoria: 'kits-combinacoes', destaque: false, observacoes: 'Consulte disponibilidade', images: [] },
  { id: 'cintos-varios-modelos', nome: 'Cintos em vários modelos, tamanhos e cores', descricao: 'Opções: Couro legítimo, Couro legítimo com elástico, Trava automática em couro legítimo, Dupla face sintético, Elástico fivela de trava.', preco: null, categoria: 'acessorios', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'camisetas-polos-diversos', nome: 'Camisetas Polos diversos modelos, cores e tamanhos', descricao: 'Diversos modelos, tamanhos e cores.', preco: null, categoria: 'camisetas-polos', destaque: false, observacoes: 'Consulte disponibilidade', images: [] },
  { id: 'ternos-costumes-variedade', nome: 'Ternos e costumes (Variedade em cores e tecidos)', descricao: 'Variedade em cores e tecidos.', preco: null, categoria: 'ternos-costumes', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'gravatas-slim-xadrez', nome: 'Gravatas Slim Xadrez 1.200 Fios', descricao: 'Muitos modelos disponíveis.', preco: 29.90, categoria: 'acessorios', destaque: false, observacoes: 'Consultar disponibilidade', images: [] },
  { id: 'cinto-couro-fasolo', nome: 'Cinto Couro Nobre Fasolo', descricao: 'Marca nacional, qualidade garantida. Diversos tamanhos disponíveis.', preco: 99.90, categoria: 'acessorios', destaque: false, observacoes: 'Consultar disponibilidade dos tamanhos', images: [] },
  { id: 'kit-calca-camisa-polo', nome: 'Kit Perfeito Calça Alfaiataria + Camisa Polo Importada Vivacci', descricao: 'Calça alfaiataria + camisa polo importada Vivacci. Modelos exclusivos da marca.', preco: null, categoria: 'kits-combinacoes', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'ternos-slim-microfibra', nome: 'Ternos Slim Microfibra Italiano', descricao: 'Diversos modelos.', preco: 499.90, categoria: 'ternos-costumes', destaque: false, observacoes: 'Consultar disponibilidade', images: [] },
  { id: 'ternos-fio-indiano', nome: 'Ternos Fio Indiano Slim Italiano', descricao: 'Diversos modelos.', preco: 599.90, categoria: 'ternos-costumes', destaque: false, observacoes: 'Consultar disponibilidade', images: [] },
  { id: 'calcas-sarjas-alfaiataria', nome: 'Calças Sarjas Alfaiataria', descricao: 'Algodão com elástano. Bolsos dianteiro modelo faca, bolsos traseiro embutidos, modelagem slim.', preco: null, categoria: 'calcas-bermudas', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'gravatas-importadas-slim', nome: 'Gravatas Importadas Slim (Vários modelos)', descricao: 'Estampas variadas.', preco: null, categoria: 'acessorios', destaque: false, observacoes: 'Consulte disponibilidade', images: [] },
  { id: 'kit-camisa-calca-esporte', nome: 'Kit 2 Camisa Social + Calça Esporte fino', descricao: 'Camisa Social Slim Fit passa fácil importada + Calça Alfaiataria esporte fino.', preco: null, categoria: 'kits-combinacoes', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'kit-camisa-gravata-prendedor', nome: 'Kit 1 Camisa social + Gravata + Prendedor de Gravata', descricao: 'Camisa Social Slim Fit importada passa fácil + Gravata importada Slim + Prendedor de gravata Slim.', preco: null, categoria: 'kits-combinacoes', destaque: false, observacoes: 'Consultar preço', images: [] },
  { id: 'cinto-elastico-trava', nome: 'Cinto Elástico com trava', descricao: 'Cinto de elástico com trava (conforto e eficiência).', preco: null, categoria: 'acessorios', destaque: false, observacoes: 'Consultar preço', images: [] },
]

const businessInfo = {
  name: 'Imperium Moda Social Masculina',
  city: 'Taquaritinga',
  slogan: 'Elegância masculina para quem quer presença, estilo e sofisticação.',
  tagline: 'Moda Social Masculina Premium',
  whatsapp: '(16) 99161-1681',
  whatsappNumber: '5516991611681',
  phone: '(16) 99161-1681',
  address: 'Rua dos Domingues, 534',
  neighborhood: 'Centro',
  cityState: 'Taquaritinga - SP',
  cep: '15900-023',
  hours: { weekdays: '09:00 - 18:00', saturday: '09:00 - 13:00' },
  instagram: '@imperium.modasocial',
  facebook: '',
  googleMapsEmbed: '',
  googleMapsLink: ''
}

async function seed() {
  console.log('Creating restaurant document...')
  await setDoc(doc(db, 'restaurants', SLUG), {
    name: 'Imperium Moda Social Masculina',
    slug: SLUG,
    type: 'roupas',
    createdAt: new Date().toISOString()
  })

  console.log(`Seeding ${products.length} products...`)
  await setDoc(doc(db, 'restaurants', SLUG, 'data', 'roupas'), {
    content: products,
    updatedAt: new Date().toISOString()
  })

  console.log('Seeding business info...')
  await setDoc(doc(db, 'restaurants', SLUG, 'data', 'businessInfo'), {
    content: businessInfo,
    updatedAt: new Date().toISOString()
  })

  console.log('Done! Seeded:')
  console.log(`- ${products.length} products`)
  console.log('- 1 businessInfo document')
  console.log(`- Slug: ${SLUG}`)
  process.exit(0)
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })
