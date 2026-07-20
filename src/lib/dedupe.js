// ─── Deduplicação por nome (tarefas e entradas) ──────────────────────────────
// Regra: itens com o MESMO nome viram um só. Horas somam, atributos normalizam
// para o "mais forte" (nunca perde informação: prazo mais cedo, prioridade mais
// urgente, bloqueante/foco ganham, status mais aberto vence).
// Puro: recebe estado, devolve estado novo. Nada de mutação in-place.

import { ENTRY_KIND_DEFAULT } from './storage'

// chave de nome: caixa, acentos e espaços repetidos não diferenciam
export function normTitle(s) {
  return (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

const first = (...vals) => vals.find(v => v != null) ?? null
const minDef = (a, b) => (a == null ? b : b == null ? a : a < b ? a : b)
const maxDef = (a, b) => (a == null ? b : b == null ? a : a > b ? a : b)

// status: quanto mais "vivo", mais forte — aberta > aguardando > concluída
const STATUS_RANK = { aberta: 0, aguardando: 1, concluida: 2 }

// funde duas tarefas com o mesmo nome. `base` é a sobrevivente (mais antiga).
export function mergeTaskPair(base, dup) {
  const status = STATUS_RANK[base.status] <= STATUS_RANK[dup.status] ? base.status : dup.status
  const waiting = status === 'aguardando'
  const done = status === 'concluida'
  return {
    ...base,
    // título: mantém a grafia da mais antiga (é a canônica)
    title: base.title,
    categoryId: first(base.categoryId, dup.categoryId),
    priority: Math.min(base.priority, dup.priority),
    blocking: base.blocking || dup.blocking,
    status,
    waitingPerson: waiting ? first(base.waitingPerson, dup.waitingPerson) : null,
    waitingSince: waiting ? minDef(base.waitingSince, dup.waitingSince) : null,
    todayDate: maxDef(base.todayDate, dup.todayDate),
    deadline: minDef(base.deadline, dup.deadline),
    createdAt: minDef(base.createdAt, dup.createdAt),
    completedAt: done ? maxDef(base.completedAt, dup.completedAt) : null,
  }
}

// tarefas do MESMO projeto com o mesmo nome viram uma. As entradas das
// absorvidas são reapontadas para a sobrevivente → o tempo soma sozinho.
export function dedupeTasks(tasks, entries) {
  const byKey = new Map()
  const remap = new Map() // idAbsorvida → idSobrevivente
  const order = []

  for (const t of [...tasks].sort((a, b) => (a.createdAt ?? a.id) - (b.createdAt ?? b.id))) {
    const key = `${t.projectId}::${normTitle(t.title)}`
    const base = byKey.get(key)
    if (!base) { byKey.set(key, t); order.push(key); continue }
    byKey.set(key, mergeTaskPair(base, t))
    remap.set(t.id, base.id)
  }

  if (!remap.size) return { tasks, entries, mergedTasks: 0, mergedEntries: 0 }

  const nextTasks = order.map(k => byKey.get(k))
  const nextEntries = entries.map(e =>
    (e.taskId != null && remap.has(e.taskId)) ? { ...e, taskId: remap.get(e.taskId) } : e
  )
  return { tasks: nextTasks, entries: nextEntries, remap, mergedTasks: remap.size }
}

// entradas do mesmo DIA + projeto + tarefa com a mesma descrição viram uma:
// duração soma, janela vira [menor início, maior fim].
// dias diferentes NUNCA fundem — o relatório diário depende disso.
export function dedupeEntries(entries) {
  const byKey = new Map()
  const order = []

  for (const e of [...entries].sort((a, b) => a.start.localeCompare(b.start))) {
    const key = [e.date, e.projectId, e.taskId ?? '-', e.kind ?? ENTRY_KIND_DEFAULT, normTitle(e.desc)].join('::')
    const base = byKey.get(key)
    if (!base) { byKey.set(key, e); order.push(key); continue }
    byKey.set(key, {
      ...base,
      categoryId: first(base.categoryId, e.categoryId),
      start: base.start <= e.start ? base.start : e.start,
      end: base.end >= e.end ? base.end : e.end,
      dur: base.dur + e.dur,
      // só continua "lançado no Simpli" se TODAS as partes já estavam
      simpli: !!base.simpli && !!e.simpli,
    })
  }

  const merged = entries.length - order.length
  if (!merged) return { entries, mergedEntries: 0 }
  const next = order.map(k => byKey.get(k))
  next.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
  return { entries: next, mergedEntries: merged }
}

// passada completa: tarefas primeiro (reaponta entradas), entradas depois
export function dedupeAll(tasks, entries) {
  const t = dedupeTasks(tasks, entries)
  const e = dedupeEntries(t.entries)
  return {
    tasks: t.tasks,
    entries: e.entries,
    mergedTasks: t.mergedTasks,
    mergedEntries: e.mergedEntries,
    total: t.mergedTasks + e.mergedEntries,
  }
}
