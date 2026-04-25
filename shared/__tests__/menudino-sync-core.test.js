import { describe, it, expect } from 'vitest'
import {
  converterMenudino,
  converterBusinessInfo,
  mergeBusinessInfo,
  mergeCardapio
} from '../menudino-sync-core.js'

describe('converterMenudino', () => {
  it('converte categorias e itens, ignorando Complementos', () => {
    const cats = [
      { id: 'c1', name: 'Pratos', sortIndex: 0 },
      { id: 'c2', name: 'Complemento', sortIndex: 1 }
    ]
    const items = {
      c1: [{ name: 'Pizza', salePrice: 50, hasPhoto: false, sortIndex: 0 }],
      c2: [{ name: 'Borda', salePrice: 5 }]
    }
    const result = converterMenudino(cats, items)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Cardápio')
    expect(result[0].categorias).toHaveLength(1)
    expect(result[0].categorias[0].titulo).toBe('Pratos')
    expect(result[0].categorias[0].itens[0].nome).toBe('Pizza')
    expect(result[0].categorias[0].itens[0].preco).toBe(50)
  })

  it('omite categorias vazias', () => {
    const result = converterMenudino(
      [{ id: 'c1', name: 'X', sortIndex: 0 }],
      { c1: [] }
    )
    expect(result[0].categorias).toHaveLength(0)
  })
})

describe('converterBusinessInfo', () => {
  it('extrai nome, endereço e horários', () => {
    const merchant = {
      name: 'Marieta Bistro',
      phone: '16999999999',
      address: { street: 'R. A', number: '10', district: 'Centro', city: 'Taq', state: 'SP', zipCode: '14600' },
      openingHours: [
        { dayOfWeek: 'Monday', startTime: '12:00:00', endTime: '15:00:00' },
        { dayOfWeek: 'Monday', startTime: '19:00:00', endTime: '23:00:00' }
      ]
    }
    const r = converterBusinessInfo(merchant)
    expect(r.name).toBe('Marieta Bistro')
    expect(r.whatsappNumber).toBe('5516999999999')
    expect(r.address).toBe('R. A, 10')
    expect(r.cityState).toBe('Taq - SP')
    expect(r.hours.almoco).toContain('Seg 12h')
    expect(r.hours.jantar).toContain('Seg 19h')
  })
})

describe('mergeBusinessInfo', () => {
  it('preserva campos manuais (slogan, instagram) ao receber novo', () => {
    const atual = { slogan: 'O melhor!', instagram: '@x', hours: { almoco: 'Seg 12h' } }
    const novo = { name: 'Novo', slogan: '', instagram: '', hours: { jantar: 'Seg 20h' } }
    const r = mergeBusinessInfo(atual, novo)
    expect(r.slogan).toBe('O melhor!')
    expect(r.instagram).toBe('@x')
    expect(r.name).toBe('Novo')
    expect(r.hours.almoco).toBe('Seg 12h')
    expect(r.hours.jantar).toBe('Seg 20h')
  })
})

describe('mergeCardapio', () => {
  it('cria estrutura inicial quando atual vazio', () => {
    const novo = converterMenudino(
      [{ id: 'c1', name: 'Pratos', sortIndex: 0 }],
      { c1: [{ name: 'Pizza', salePrice: 50, hasPhoto: false }] }
    )
    const r = mergeCardapio(null, novo)
    expect(r.stats.adicionados).toBe(1)
    expect(r.stats.categorias_novas).toBe(1)
    expect(r.cardapio.find(t => t.id === 'cardapio')).toBeTruthy()
    expect(r.cardapio.find(t => t.id === 'bebidas')).toBeTruthy()
  })

  it('atualiza preço de item existente, preserva descrição manual', () => {
    const atual = [{
      id: 'cardapio', label: 'Cardápio', ativo: true,
      categorias: [{ titulo: 'Pratos', itens: [
        { nome: 'Pizza', preco: 40, desc: 'Massa fina artesanal', imagem: 'old.jpg', ativo: true }
      ]}]
    }]
    const novo = converterMenudino(
      [{ id: 'c1', name: 'Pratos', sortIndex: 0 }],
      { c1: [{ name: 'Pizza', salePrice: 50, hasPhoto: false, description: '' }] }
    )
    const r = mergeCardapio(atual, novo)
    const item = r.cardapio[0].categorias[0].itens[0]
    expect(item.preco).toBe(50)
    expect(item.desc).toBe('Massa fina artesanal')
    expect(r.stats.atualizados).toBe(1)
    expect(r.stats.preservados_desc).toBe(1)
  })

  it('inativa item ausente no novo payload', () => {
    const atual = [{
      id: 'cardapio', label: 'Cardápio', ativo: true,
      categorias: [{ titulo: 'Pratos', itens: [
        { nome: 'Pizza', preco: 40, ativo: true },
        { nome: 'Lasanha', preco: 30, ativo: true }
      ]}]
    }]
    const novo = converterMenudino(
      [{ id: 'c1', name: 'Pratos', sortIndex: 0 }],
      { c1: [{ name: 'Pizza', salePrice: 40, hasPhoto: false }] }
    )
    const r = mergeCardapio(atual, novo)
    const lasanha = r.cardapio[0].categorias[0].itens.find(i => i.nome === 'Lasanha')
    expect(lasanha.ativo).toBe(false)
    expect(r.stats.inativados).toBe(1)
  })
})
