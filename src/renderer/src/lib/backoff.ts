// Backoff exponencial usado pela reconexão do Realtime (ResilientChannel).
// Extraído como função pura pra ser testável sem subir o cliente Supabase.

export const BACKOFF_MS = [2000, 5000, 10000, 30000, 60000]

// Dado o número de tentativas já feitas, retorna o delay da próxima.
// Satura no último valor (60s) — nunca passa do teto, nunca quebra com
// retryCount negativo ou gigante.
export const backoffDelay = (retryCount: number): number => {
  const i = Math.min(Math.max(retryCount, 0), BACKOFF_MS.length - 1)
  return BACKOFF_MS[i]
}
