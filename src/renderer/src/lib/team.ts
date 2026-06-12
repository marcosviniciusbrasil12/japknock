import { supabase, ResilientSubscription } from './supabase'

export type SectorId = 'inovacao' | 'financeiro' | 'contabil' | 'infra' | 'marketing' | 'rh'

export type Sector = {
  id: SectorId
  name: string
}

export type TeamMember = {
  id: string
  name: string
  role: 'sender' | 'receiver'
  initials: string
  sector: SectorId | null
}

// Setores disponíveis pra escolher no registro. Vazios viram um header
// "em breve" no popover do Sender até alguém entrar.
export const SECTORS: Sector[] = [
  { id: 'inovacao', name: 'Inovação' },
  { id: 'financeiro', name: 'Financeiro' },
  { id: 'contabil', name: 'Contábil' },
  { id: 'infra', name: 'Infraestrutura' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'rh', name: 'RH/DP' }
]

const USERS_TABLE = 'japknock_users'

type DbUser = {
  user_id: string
  name: string
  initials: string
  role: 'sender' | 'receiver'
  sector: SectorId | null
}

const fromDb = (u: DbUser): TeamMember => ({
  id: u.user_id,
  name: u.name,
  initials: u.initials,
  role: u.role,
  sector: u.sector
})

// Retorna null em falha (rede/permissão) — diferente de [] (equipe vazia de
// verdade). Quem consome NUNCA deve tratar null como "usuário não existe":
// apagar identidade local por causa de um erro de rede era o bug que deixava
// a máquina surda pra sempre (boot antes do Wi-Fi conectar).
export const fetchTeam = async (): Promise<TeamMember[] | null> => {
  try {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select('user_id, name, initials, role, sector')
      .order('role', { ascending: true }) // sender primeiro
      .order('name', { ascending: true })
    if (error) {
      console.error('fetchTeam failed', error)
      return null
    }
    return (data ?? []).map(fromDb)
  } catch (e) {
    console.error('fetchTeam exception', e)
    return null
  }
}

export const subscribeToTeamChanges = (
  onChange: (team: TeamMember[]) => void
): ResilientSubscription => {
  const refresh = async (): Promise<void> => {
    const next = await fetchTeam()
    // null = falha de rede; [] não acontece em produção (helena é seed
    // permanente). Só propaga lista real pra não "sumir" todo mundo da tela.
    if (next && next.length > 0) onChange(next)
  }
  return new ResilientSubscription({
    label: 'team-changes',
    build: () =>
      supabase
        .channel('japknock-users-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: USERS_TABLE }, () => {
          refresh()
        }),
    // Catch-up: a cada (re)conexão, puxa a lista atual. Pega cadastros que
    // entraram enquanto o cliente estava offline (postgres_changes não dá replay).
    onSubscribed: refresh
  }).start()
}

// Helpers — recebem o team atual (do estado React) em vez de hardcoded
export const receiversOf = (team: TeamMember[]): TeamMember[] =>
  team.filter((t) => t.role === 'receiver')

export const findMemberIn = (team: TeamMember[], id: string): TeamMember | undefined =>
  team.find((t) => t.id === id)

export const membersOfSectorIn = (team: TeamMember[], sectorId: SectorId): TeamMember[] =>
  receiversOf(team).filter((m) => m.sector === sectorId)

// === Registro de novo usuário ===

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const registerUser = async (name: string, sector: SectorId): Promise<TeamMember | null> => {
  const baseId = slugify(name)
  if (!baseId) return null

  // Tenta com user_id base. Se duplicado, vai com sufixo numérico.
  let userId = baseId
  let attempt = 1
  while (attempt < 20) {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .insert({
        user_id: userId,
        name: name.trim(),
        initials: initialsOf(name),
        role: 'receiver',
        sector
      })
      .select('user_id, name, initials, role, sector')
      .single()

    if (!error && data) return fromDb(data)
    // 23505 = unique_violation
    if (error?.code === '23505') {
      attempt++
      userId = `${baseId}-${attempt}`
      continue
    }
    console.error('registerUser failed', error)
    return null
  }
  return null
}

// === localStorage da identidade local ===

const STORAGE_KEY = 'japknock.me'

export const getStoredMeId = (): string | null => localStorage.getItem(STORAGE_KEY)
export const setStoredMeId = (id: string): void => localStorage.setItem(STORAGE_KEY, id)
export const clearStoredMeId = (): void => localStorage.removeItem(STORAGE_KEY)
