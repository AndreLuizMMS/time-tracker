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

// ─── Agrupamento VISUAL de entradas (não destrutivo) ─────────────────────────
// Entradas com a mesma descrição, no mesmo dia/projeto/classificação, são o
// mesmo trabalho partido em blocos (manhã + tarde). A lista mostra UMA linha
// com o total; os blocos continuam existindo, separados, e podem ser abertos.
// Nada aqui altera o estado — só reorganiza para renderizar.
export function groupEntriesByName(entries) {
  const byKey = new Map()
  const order = []

  for (const e of entries) {
    const name = normTitle(e.desc)
    // "Sem descrição" não é nome — entradas sem título nunca agrupam entre si
    const key = name === '' || name === 'sem descricao'
      ? `solo::${e.id}`
      : [e.date, e.projectId, e.kind ?? ENTRY_KIND_DEFAULT, name].join('::')
    const g = byKey.get(key)
    if (!g) { byKey.set(key, { key, items: [e] }); order.push(key); continue }
    g.items.push(e)
  }

  return order.map(k => {
    const { items } = byKey.get(k)
    const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start))
    return {
      key: k,
      items: sorted,
      lead: sorted[0],                                  // representa o grupo (desc, projeto, categoria)
      total: sorted.reduce((s, e) => s + e.dur, 0),     // soma de horas do grupo
      count: sorted.length,
      firstStart: sorted[0].start,
      lastEnd: sorted[sorted.length - 1].end,
      // grupo só conta como lançado no Simpli quando TODOS os blocos estão
      allSimpli: sorted.every(e => !!e.simpli),
      anySimpli: sorted.some(e => !!e.simpli),
    }
  })
}
