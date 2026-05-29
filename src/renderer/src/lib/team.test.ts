import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock do cliente Supabase pra não subir rede ao importar team.ts.
// `state.results` é uma fila que cada chamada a .single() consome; `state.inserts`
// captura os payloads enviados pra a gente checar a lógica de colisão de id.
const state = vi.hoisted(() => ({
  results: [] as Array<{ data: unknown; error: unknown }>,
  inserts: [] as Array<Record<string, unknown>>
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        state.inserts.push(row)
        return {
          select: () => ({
            single: async () => state.results.shift() ?? { data: null, error: { code: 'EMPTY' } }
          })
        }
      }
    })
  }
}))

import {
  slugify,
  initialsOf,
  findMemberIn,
  receiversOf,
  membersOfSectorIn,
  registerUser,
  TeamMember
} from './team'

const team: TeamMember[] = [
  { id: 'helena', name: 'Helena', role: 'sender', initials: 'HE', sector: null },
  { id: 'marcos', name: 'Marcos', role: 'receiver', initials: 'MA', sector: 'infra' },
  { id: 'maira', name: 'Maira', role: 'receiver', initials: 'MA', sector: 'rh' }
]

describe('slugify', () => {
  it('remove acentos e normaliza', () => {
    expect(slugify('José da Silva')).toBe('jose-da-silva')
    expect(slugify('Ângela Côrtes')).toBe('angela-cortes')
  })
  it('colapsa símbolos e espaços', () => {
    expect(slugify('  Maria   João!! ')).toBe('maria-joao')
  })
  it('retorna vazio quando não sobra nada utilizável', () => {
    expect(slugify('!!!')).toBe('')
    expect(slugify('   ')).toBe('')
  })
})

describe('initialsOf', () => {
  it('nome composto usa primeira + última', () => {
    expect(initialsOf('José da Silva')).toBe('JS')
    expect(initialsOf('Marcos Vinicius Brasil')).toBe('MB')
  })
  it('nome único usa as 2 primeiras letras', () => {
    expect(initialsOf('Helena')).toBe('HE')
  })
  it('não quebra com string vazia ou só espaços', () => {
    expect(initialsOf('')).toBe('')
    expect(initialsOf('   ')).toBe('')
  })
})

describe('findMemberIn / receiversOf / membersOfSectorIn', () => {
  it('acha por id, undefined quando não existe', () => {
    expect(findMemberIn(team, 'marcos')?.name).toBe('Marcos')
    expect(findMemberIn(team, 'fantasma')).toBeUndefined()
  })
  it('receiversOf exclui o sender', () => {
    const r = receiversOf(team)
    expect(r.map((m) => m.id)).toEqual(['marcos', 'maira'])
    expect(r.some((m) => m.role === 'sender')).toBe(false)
  })
  it('membersOfSectorIn filtra por setor (e só receivers)', () => {
    expect(membersOfSectorIn(team, 'infra').map((m) => m.id)).toEqual(['marcos'])
    expect(membersOfSectorIn(team, 'marketing')).toEqual([])
  })
})

describe('registerUser — colisão de id (bug de race do cadastro)', () => {
  beforeEach(() => {
    state.results = []
    state.inserts = []
  })

  it('aplica sufixo numérico quando o id base colide (23505)', async () => {
    state.results = [
      { data: null, error: { code: '23505' } }, // 'marcos' já existe
      {
        data: {
          user_id: 'marcos-2',
          name: 'Marcos',
          initials: 'MA',
          role: 'receiver',
          sector: 'infra'
        },
        error: null
      }
    ]
    const m = await registerUser('Marcos', 'infra')
    expect(state.inserts[0].user_id).toBe('marcos')
    expect(state.inserts[1].user_id).toBe('marcos-2')
    expect(m?.id).toBe('marcos-2')
  })

  it('grava iniciais e role=receiver calculados', async () => {
    state.results = [
      {
        data: {
          user_id: 'ana-paula',
          name: 'Ana Paula',
          initials: 'AP',
          role: 'receiver',
          sector: 'rh'
        },
        error: null
      }
    ]
    await registerUser('Ana Paula', 'rh')
    expect(state.inserts[0].initials).toBe('AP')
    expect(state.inserts[0].role).toBe('receiver')
  })

  it('retorna null sem tentar inserir quando o nome não vira slug', async () => {
    const m = await registerUser('!!!', 'infra')
    expect(m).toBeNull()
    expect(state.inserts).toHaveLength(0)
  })
})
