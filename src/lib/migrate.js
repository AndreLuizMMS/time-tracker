// ─── Migração v1 → v2 (idempotente) ──────────────────────────────────────────
// Risco concentrado aqui. Roda no boot (localStorage) e no import (arquivo).
// HAZARD: a chave tt_projects HOJE guarda CATEGORIAS. A ordem importa:
// ler tt_projects → gravar em tt_categories → só então sobrescrever tt_projects com projetos.

import {
  KEYS, SCHEMA_VERSION, GERAL, GERAL_ID, SEED_PROJECTS,
  DEFAULT_CATEGORIES, PRIORITY_DEFAULT, loadStorage, saveStorage,
} from './storage'

// normaliza uma entrada garantindo os campos v2 (proj → categoryId, ganha projectId)
export function normEntry(e) {
  return {
    id: e.id,
    date: e.date,
    desc: e.desc,
    start: e.start,
    end: e.end,
    dur: e.dur,
    projectId: e.projectId ?? GERAL_ID,
    categoryId: e.categoryId ?? e.proj ?? null,
    taskId: e.taskId ?? null,
  }
}

// normaliza uma tarefa: done → status, ganha projectId/categoryId/waiting*/deadline
export function normTask(t) {
  const status = t.status ?? (t.done ? 'concluida' : 'aberta')
  return {
    id: t.id,
    title: t.title,
    projectId: t.projectId ?? GERAL_ID,
    categoryId: t.categoryId ?? null,
    priority: t.priority ?? PRIORITY_DEFAULT,
    blocking: t.blocking ?? false,
    status,
    waitingPerson: status === 'aguardando' ? (t.waitingPerson ?? null) : null,
    waitingSince: status === 'aguardando' ? (t.waitingSince ?? null) : null,
    todayDate: t.todayDate ?? null,
    deadline: t.deadline ?? null,
    createdAt: t.createdAt ?? t.id,
    completedAt: status === 'concluida' ? (t.completedAt ?? null) : null,
  }
}

// garante que exista um Geral (id 'geral') no topo da lista de projetos
export function ensureGeral(projects) {
  const list = Array.isArray(projects) ? projects.filter(p => p.id !== GERAL_ID) : []
  const existing = Array.isArray(projects) ? projects.find(p => p.id === GERAL_ID) : null
  return [existing ? { ...GERAL, ...existing, id: GERAL_ID, name: 'Geral' } : { ...GERAL }, ...list]
}

// v1: { projects(=categorias), entries, tasks } → v2
export function migrateV1toV2(raw) {
  const categories = (Array.isArray(raw?.projects) && raw.projects.length)
    ? raw.projects.map(c => ({ id: c.id, name: c.name, color: c.color }))
    : DEFAULT_CATEGORIES.map(c => ({ ...c }))
  return {
    projects: SEED_PROJECTS.map(p => ({ ...p })),
    categories,
    entries: (raw?.entries ?? []).map(normEntry),
    tasks: (raw?.tasks ?? []).map(normTask),
  }
}

// v2 já formado (export nosso) → só normaliza/garante invariantes
export function normalizeV2(data) {
  const categories = (Array.isArray(data?.categories) && data.categories.length)
    ? data.categories.map(c => ({ id: c.id, name: c.name, color: c.color }))
    : DEFAULT_CATEGORIES.map(c => ({ ...c }))
  const projects = ensureGeral(
    (Array.isArray(data?.projects) && data.projects.length) ? data.projects : SEED_PROJECTS
  )
  return {
    projects,
    categories,
    entries: (data?.entries ?? []).map(normEntry),
    tasks: (data?.tasks ?? []).map(normTask),
  }
}

// detecta versão e devolve estado v2 — usado pelo import de arquivo
export function importData(data) {
  const isV2 = data?.version >= 2 || Array.isArray(data?.categories)
  return isV2 ? normalizeV2(data) : migrateV1toV2(data)
}

// boot a partir do localStorage; migra uma única vez e marca tt_schema=2
export function bootstrapState() {
  const schema = loadStorage(KEYS.schema, null)
  if (schema?.version >= SCHEMA_VERSION) {
    return {
      projects: ensureGeral(loadStorage(KEYS.projects, SEED_PROJECTS)),
      categories: loadStorage(KEYS.categories, DEFAULT_CATEGORIES),
      entries: (loadStorage(KEYS.entries, []) ?? []).map(normEntry),
      tasks: (loadStorage(KEYS.tasks, []) ?? []).map(normTask),
    }
  }

  // v1 → v2 — tt_projects atual = categorias
  const legacyCategories = loadStorage(KEYS.projects, null)
  const legacyEntries = loadStorage(KEYS.entries, null)
  const legacyTasks = loadStorage(KEYS.tasks, null)
  const migrated = migrateV1toV2({
    projects: legacyCategories,
    entries: legacyEntries,
    tasks: legacyTasks,
  })

  saveStorage(KEYS.categories, migrated.categories)
  saveStorage(KEYS.projects, migrated.projects) // sobrescreve DEPOIS de extrair categorias
  saveStorage(KEYS.entries, migrated.entries)
  saveStorage(KEYS.tasks, migrated.tasks)

  // timer ativo legado: proj → categoryId, ganha projectId
  const timer = loadStorage(KEYS.timer, null)
  if (timer && timer.categoryId === undefined) {
    saveStorage(KEYS.timer, {
      ...timer,
      categoryId: timer.proj ?? null,
      projectId: timer.projectId ?? GERAL_ID,
    })
  }

  saveStorage(KEYS.schema, { version: SCHEMA_VERSION })
  return migrated
}
