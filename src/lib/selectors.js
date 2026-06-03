// ─── Seletores derivados (puros) ─────────────────────────────────────────────

import { localDateStr, addDays } from './format'
import { GERAL_ID } from './storage'

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// dias úteis inteiros decorridos entre o dia de `ts` e hoje (exclui Sáb/Dom; sem feriados)
// mesmo dia → 0; Sex→Seg → 1 (o fim de semana não conta, por isso "dias úteis")
export function businessDaysSince(ts, now = Date.now()) {
  if (ts == null) return 0
  const end = startOfDay(now)
  let count = 0
  let d = addDays(startOfDay(ts), 1)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d = addDays(d, 1)
  }
  return count
}

// sinais derivados de uma tarefa
export function taskSignals(task, today) {
  const isFocus = task.todayDate === today
  let deadlineState = null
  if (task.deadline) {
    deadlineState = task.deadline < today ? 'overdue' : task.deadline === today ? 'today' : 'future'
  }
  const deadlineDue = task.deadline != null && task.status !== 'concluida' && task.deadline <= today
  const businessDays = task.status === 'aguardando' && task.waitingSince != null
    ? businessDaysSince(task.waitingSince)
    : 0
  const waitingStuck = task.status === 'aguardando' && task.waitingSince != null && businessDays >= 2
  return { isFocus, deadlineState, deadlineDue, businessDays, waitingStuck }
}

// radar transversal — ignora projeto, agrupa por tipo de urgência
export function buildRadar(tasks, today) {
  const live = tasks.filter(t => t.status !== 'concluida')
  const atrasadas = live
    .filter(t => t.deadline && t.deadline <= today)
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.priority - b.priority)
  const aguardando = tasks
    .filter(t => taskSignals(t, today).waitingStuck)
    .sort((a, b) => (a.waitingSince || 0) - (b.waitingSince || 0))
  const foco = live
    .filter(t => t.todayDate === today)
    .sort((a, b) => a.priority - b.priority)
  return { atrasadas, aguardando, foco, isEmpty: !atrasadas.length && !aguardando.length && !foco.length }
}

// visão por projeto — VM por projeto (ocultos fora; Geral por último)
export function buildProjectView(projects, tasks, entries, today, from, to) {
  const ordered = projects
    .filter(p => !p.hidden)
    .sort((a, b) => (a.id === GERAL_ID ? 1 : 0) - (b.id === GERAL_ID ? 1 : 0))
  return ordered.map(p => {
    const pTasks = tasks.filter(t => t.projectId === p.id)
    const abertas = pTasks
      .filter(t => t.status === 'aberta')
      .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)
    const aguardando = pTasks
      .filter(t => t.status === 'aguardando')
      .sort((a, b) => (a.waitingSince || 0) - (b.waitingSince || 0))
    const concluidasHoje = pTasks.filter(
      t => t.status === 'concluida' && t.completedAt && localDateStr(new Date(t.completedAt)) === today
    )
    const periodSecs = entries
      .filter(e => e.projectId === p.id && (!from || e.date >= from) && (!to || e.date <= to))
      .reduce((s, e) => s + e.dur, 0)
    return { project: p, abertas, aguardando, concluidasHoje, periodSecs, openCount: abertas.length }
  })
}

// cola do daily — 3 blocos (listas brutas; agrupamento por projeto fica na UI)
export function buildCola(tasks, entries, today) {
  // último dia de trabalho = dia com entrada de tempo OU tarefa concluída
  // (tarefa fechada sem cronômetro também conta como trabalho feito)
  const doneDates = tasks
    .filter(t => t.status === 'concluida' && t.completedAt)
    .map(t => localDateStr(new Date(t.completedAt)))
  const past = [...new Set([...entries.map(e => e.date), ...doneDates])].filter(d => d < today).sort()
  const lastDay = past.length ? past[past.length - 1] : localDateStr(addDays(new Date(), -1))
  const fizEntries = entries
    .filter(e => e.date === lastDay)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
  const fizDone = tasks.filter(
    t => t.status === 'concluida' && t.completedAt && localDateStr(new Date(t.completedAt)) === lastDay
  )
  const vouFazer = tasks.filter(t => t.todayDate === today && t.status !== 'concluida')
  const aguardando = tasks
    .filter(t => t.status === 'aguardando')
    .sort((a, b) => (a.waitingSince || 0) - (b.waitingSince || 0))
  return { lastDay, fizEntries, fizDone, vouFazer, aguardando }
}

// agrupa itens por projectId, preservando a ordem dos projetos; ignora grupos vazios
export function groupByProject(items, projects) {
  return projects
    .map(p => ({ project: p, items: items.filter(it => it.projectId === p.id) }))
    .filter(g => g.items.length > 0)
}
