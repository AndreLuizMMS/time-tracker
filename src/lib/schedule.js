// ─── Organização dos horários de um dia ─────────────────────────────────────
// Empilha as entradas em sequência a partir das 9h, sem sobreposição, mantendo
// a duração e a ordem (início; empate/sem horário → criação). Almoço 12:00–13:40 é pulado; entrada
// que cruza o almoço é dividida em dois blocos (mesmo nome → agrupam na UI).
// Sem teto: o dia termina quando acabam as horas. Puro.

import { secsToTime } from './format'

const DAY_START = 9 * 3600
const LUNCH_START = 12 * 3600
const LUNCH_END = 13 * 3600 + 40 * 60

const place = (e, from, dur) => ({ ...e, start: secsToTime(from), end: secsToTime((from + dur) % 86400), dur })

// dayEntries: entradas de UM dia; nextId: id inicial para blocos criados na divisão
export function organizeDay(dayEntries, nextId) {
  // ordem: horário de início; empate ou sem horário → ordem de criação (id = timestamp de criação)
  const ordered = [...dayEntries].sort((a, b) =>
    (a.start && b.start ? a.start.localeCompare(b.start) : !a.start - !b.start) || a.id - b.id)
  const out = []
  let cursor = DAY_START
  for (const e of ordered) {
    if (cursor >= LUNCH_START && cursor < LUNCH_END) cursor = LUNCH_END
    const beforeLunch = LUNCH_START - cursor
    if (cursor < LUNCH_START && e.dur > beforeLunch) {
      out.push(place(e, cursor, beforeLunch))
      out.push(place({ ...e, id: nextId++ }, LUNCH_END, e.dur - beforeLunch))
      cursor = LUNCH_END + e.dur - beforeLunch
    } else {
      out.push(place(e, cursor, e.dur))
      cursor += e.dur
    }
  }
  return out
}
