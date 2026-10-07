// ─── Organização dos horários de um dia ─────────────────────────────────────
// Empilha as entradas em sequência a partir das 9h, sem sobreposição, mantendo
// a duração e a ordem (início; empate/sem horário → criação). Almoço 12:00–13:40 é pulado; entrada
// que cruza o almoço é dividida em dois blocos (mesmo nome → agrupam na UI).
// Sem teto: o dia termina quando acabam as horas. Puro.

import { secsToTime, timeToSecs } from './format'

const DAY_START = 9 * 3600
const LUNCH_START = 12 * 3600
const LUNCH_END = 13 * 3600 + 40 * 60

const place = (e, from, dur) => ({ ...e, start: secsToTime(from), end: secsToTime((from + dur) % 86400), dur })

// dayEntries: entradas de UM dia; nextId: id inicial para blocos criados na divisão
// Entradas com manualTime (início e fim digitados pelo usuário) ficam fixas; o almoço e as fixas
// viram faixas ocupadas e as demais fluem pelos espaços livres (dividindo-se se não couberem).
export function organizeDay(dayEntries, nextId) {
  const fixed = dayEntries.filter(e => e.manualTime)
  const busy = [[LUNCH_START, LUNCH_END], ...fixed.filter(e => e.dur > 0).map(e => {
    const s = timeToSecs(e.start)
    return [s, s + e.dur]
  })].sort((a, b) => a[0] - b[0])
  // ordem: horário de início; empate ou sem horário → ordem de criação (id = timestamp de criação)
  const ordered = dayEntries.filter(e => !e.manualTime).sort((a, b) =>
    (a.start && b.start ? a.start.localeCompare(b.start) : !a.start - !b.start) || a.id - b.id)
  const out = [...fixed]
  let cursor = DAY_START
  for (const e of ordered) {
    let left = e.dur, part = e
    do {
      for (const [s, f] of busy) if (cursor >= s && cursor < f) cursor = f
      const gap = (busy.find(([s]) => s > cursor)?.[0] ?? Infinity) - cursor
      const chunk = Math.min(left, gap)
      out.push(place(part, cursor, chunk))
      cursor += chunk
      left -= chunk
      part = { ...e, id: nextId++ }
    } while (left > 0)
  }
  return out
}
