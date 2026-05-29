// Formatação de timestamps relativos exibida na lista de "recentes" do Receiver.
// `now` é injetável pra deixar os testes determinísticos (default = Date.now()).

const pad = (n: number): string => n.toString().padStart(2, '0')

// Rótulo descritivo: "há 5s", "há 3 min", "hoje, 14:20", "29/5 14:20".
export const formatWhen = (ts: number, now: number = Date.now()): string => {
  const d = new Date(ts)
  const diff = now - ts
  if (diff < 60_000) return `há ${Math.floor(diff / 1000)}s`
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`
  const isToday = d.toDateString() === new Date(now).toDateString()
  if (isToday) return `hoje, ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getDate()}/${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Rótulo curto pra coluna da direita: "agora", "há 12m", "há 3h", "ontem".
export const relativeLabel = (ts: number, now: number = Date.now()): string => {
  const diff = now - ts
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`
  return 'ontem'
}
