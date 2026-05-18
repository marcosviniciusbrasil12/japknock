let ctx: AudioContext | null = null

const ensureCtx = (): AudioContext => {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

const beep = (frequency: number, startAt: number, duration: number): void => {
  const audio = ensureCtx()
  const t = audio.currentTime + startAt
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, t)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.25, t + 0.01)
  gain.gain.linearRampToValueAtTime(0, t + duration)
  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

export const playKnock = (): void => {
  beep(880, 0, 0.12)
  beep(880, 0.18, 0.12)
}

export const playSent = (): void => {
  beep(1320, 0, 0.06)
}
