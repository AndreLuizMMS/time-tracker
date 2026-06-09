// ─── Format & date helpers (puros, sem React) ───────────────────────────────

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const pad2 = n => String(n).padStart(2, '0')

export function fmtDur(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

export function fmtHM(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

// duração no relógio HH:MM (sem segundos); suporta >24h (ex.: 1800s → "00:30", 30600s → "08:30")
export function fmtClock(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${pad2(h)}:${pad2(m)}`
}

export function timeToSecs(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 3600 + m * 60
}

export function secsToTime(s) {
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}`
}

// data local (evita deslocamento de fuso do toISOString em UTC)
export function localDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayStr() {
  return localDateStr(new Date())
}

// retorna nova data deslocada em n dias (puro, não muta o argumento)
export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function fmtDate(d) {
  const dt = new Date(d + 'T12:00:00')
  const now = new Date()
  const today = localDateStr(now)
  const ydStr = localDateStr(addDays(now, -1))
  if (d === today) return 'Hoje'
  if (d === ydStr) return 'Ontem'
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// rótulo curto "Seg 3/6" para um dia qualquer
export function fmtDayShort(d) {
  const dt = new Date(d + 'T12:00:00')
  return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}`
}

// hora HH:MM de um timestamp epoch
export function fmtTime(ts) {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// ─── CSV / download ──────────────────────────────────────────────────────────

export function csvCell(v) {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// dispara download de um arquivo gerado em memória
export function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
