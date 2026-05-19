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

export const SECTORS: Sector[] = [
  { id: 'inovacao', name: 'Inovação' }
  // Outros setores virão quando tiver gente neles. Mantendo só Inovação por enquanto.
]

export const TEAM: TeamMember[] = [
  { id: 'helena', name: 'Helena', role: 'sender', initials: 'HE', sector: null },
  { id: 'marcos', name: 'Marcos', role: 'receiver', initials: 'MA', sector: 'inovacao' },
  { id: 'maira', name: 'Maira', role: 'receiver', initials: 'MI', sector: 'inovacao' },
  { id: 'silvio', name: 'Silvio', role: 'receiver', initials: 'SI', sector: 'inovacao' },
  { id: 'daniel', name: 'Daniel', role: 'receiver', initials: 'DA', sector: 'inovacao' },
  { id: 'vinicius', name: 'Vinicius', role: 'receiver', initials: 'VI', sector: 'inovacao' },
  { id: 'paulo', name: 'Paulo', role: 'receiver', initials: 'PA', sector: 'inovacao' }
]

export const RECEIVERS = TEAM.filter((t) => t.role === 'receiver')
export const findMember = (id: string): TeamMember | undefined => TEAM.find((t) => t.id === id)
export const membersOfSector = (sectorId: SectorId): TeamMember[] =>
  RECEIVERS.filter((m) => m.sector === sectorId)

const STORAGE_KEY = 'japknock.me'
export const getStoredMe = (): TeamMember | null => {
  const id = localStorage.getItem(STORAGE_KEY)
  if (!id) return null
  return findMember(id) ?? null
}
export const setStoredMe = (id: string): void => {
  localStorage.setItem(STORAGE_KEY, id)
}
export const clearStoredMe = (): void => {
  localStorage.removeItem(STORAGE_KEY)
}
