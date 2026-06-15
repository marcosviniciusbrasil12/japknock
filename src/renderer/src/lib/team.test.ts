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
  sectorsVisibleTo,
  registerUser,
  SECTORS,
  TeamMember
} from './team'

const team: TeamMember[] = [
  { id: 'helena', name: 'Helena', role: 'sender', initials: 'HE', sector: null },
  { id: 'marcos', name: 'Marcos', role: 'receiver', initials: 'MA', sector: 'infra' },
  { id: 'maira', name: 'Maira', role: 'receiver', initials: 'MA', sector: 'rh' },
  { id: 'rejane', name: 'Rejane', role: 'manager', initials: 'RE', sector: 'financeiro' },
  { id: 'paulo', name: 'Paulo', role: 'receiver', initials: 'PA', sector: 'financeiro' }
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
  it('receiversOf exclui sender e manager', () => {
    const r = receiversOf(team)
    expect(r.map((m) => m.id)).toEqual(['marcos', 'maira', 'paulo'])
    expect(r.some((m) => m.role !== 'receiver')).toBe(false)
  })
  it('membersOfSectorIn inclui receivers E managers do setor (gestor é chamável)', () => {
    expect(membersOfSectorIn(team, 'infra').map((m) => m.id)).toEqual(['marcos'])
    expect(membersOfSectorIn(team, 'financeiro').map((m) => m.id)).toEqual(['rejane', 'paulo'])
    expect(membersOfSectorIn(team, 'marketing')).toEqual([])
  })
  it('membersOfSectorIn nunca inclui o sender', () => {
    for (const s of SECTORS) {
      expect(membersOfSectorIn(team, s.id).some((m) => m.role === 'sender')).toBe(false)
    }
  })
})

describe('sectorsVisibleTo — quem pode chamar quem', () => {
  it('sender (Helena) vê todos os setores', () => {
    expect(sectorsVisibleTo(team[0])).toEqual(SECTORS)
  })
  it('manager vê APENAS o próprio setor', () => {
    const rejane = findMemberIn(team, 'rejane')!
    expect(sectorsVisibleTo(rejane).map((s) => s.id)).toEqual(['financeiro'])
  })
  it('receiver não vê setor nenhum (não chama ninguém)', () => {
    const marcos = findMemberIn(team, 'marcos')!
    expect(sectorsVisibleTo(marcos)).toEqual([])
  })
  it('manager sem setor (dado ruim) não vê nada em vez de quebrar', () => {
    const semSetor: TeamMember = {
      id: 'x',
      name: 'X',
      role: 'manager',
      initials: 'XX',
      sector: null
    }
    expect(sectorsVisibleTo(semSetor)).toEqual([])
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
