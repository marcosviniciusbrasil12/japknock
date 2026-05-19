import { supabase } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

export type SectorId = 'inovacao' | 'financeiro' | 'contabil' | 'infra' | 'marketing'

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
  { id: 'marketing', name: 'Marketing' }
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

export const fetchTeam = async (): Promise<TeamMember[]> => {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('user_id, name, initials, role, sector')
    .order('role', { ascending: true }) // sender primeiro
    .order('name', { ascending: true })
  if (error) {
    console.error('fetchTeam failed', error)
    return []
  }
  return (data ?? []).map(fromDb)
}

export const subscribeToTeamChanges = (
  onChange: (team: TeamMember[]) => void
): RealtimeChannel => {
  return supabase
    .channel('japknock-users-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: USERS_TABLE }, async () => {
      const team = await fetchTeam()
      onChange(team)
    })
    .subscribe()
}

// Helpers — recebem o team atual (do estado React) em vez de hardcoded
export const receiversOf = (team: TeamMember[]): TeamMember[] =>
  team.filter((t) => t.role === 'receiver')

export const findMemberIn = (team: TeamMember[], id: string): TeamMember | undefined =>
  team.find((t) => t.id === id)

export const membersOfSectorIn = (team: TeamMember[], sectorId: SectorId): TeamMember[] =>
  receiversOf(team).filter((m) => m.sector === sectorId)

// === Registro de novo usuário ===

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const registerUser = async (
  name: string,
  sector: SectorId
): Promise<TeamMember | null> => {
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
