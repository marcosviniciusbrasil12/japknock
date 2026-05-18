export type TeamMember = {
  id: string
  name: string
  role: 'sender' | 'receiver'
  initials: string
  color: string
}

export const TEAM: TeamMember[] = [
  { id: 'helena', name: 'Helena', role: 'sender', initials: 'HE', color: '#EC4899' },
  { id: 'marcos', name: 'Marcos', role: 'receiver', initials: 'MA', color: '#3B82F6' },
  { id: 'maira', name: 'Maira', role: 'receiver', initials: 'MI', color: '#10B981' },
  { id: 'silvio', name: 'Silvio', role: 'receiver', initials: 'SI', color: '#F59E0B' },
  { id: 'daniel', name: 'Daniel', role: 'receiver', initials: 'DA', color: '#8B5CF6' },
  { id: 'vinicius', name: 'Vinicius', role: 'receiver', initials: 'VI', color: '#EF4444' },
  { id: 'paulo', name: 'Paulo', role: 'receiver', initials: 'PA', color: '#06B6D4' }
]

export const RECEIVERS = TEAM.filter((t) => t.role === 'receiver')
export const findMember = (id: string): TeamMember | undefined => TEAM.find((t) => t.id === id)

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
