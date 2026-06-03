// ─── Constantes de domínio + persistência ───────────────────────────────────

export const SCHEMA_VERSION = 2

export const KEYS = {
  schema: 'tt_schema',
  projects: 'tt_projects',     // Projeto[] (frentes de trabalho) — REPROPÓSITO no v2
  categories: 'tt_categories', // Categoria[] (global) — recebe o antigo tt_projects
  entries: 'tt_entries',
  tasks: 'tt_tasks',
  timer: 'tt_timer',
}

// Balde embutido: string nunca colide com ids numéricos (Date.now()) nem com a categoria id 0
export const GERAL_ID = 'geral'
export const GERAL = { id: GERAL_ID, name: 'Geral', color: '#1D9E75' }

// Projetos-semente: só o balde Geral (embutido, obrigatório). Sem projetos base — começa limpo.
export const SEED_PROJECTS = [GERAL]

// Sem categorias base — começa limpo. Usuário cria as suas.
export const DEFAULT_CATEGORIES = []

export const PALETTE = ['#1D9E75', '#2FB488', '#378ADD', '#7F77DD', '#D4537E', '#E24B4A', '#E0A03B', '#BA7517', '#54534E']
export const FALLBACK_COLOR = '#74726b'

// Prioridade: 1=Urgente … 4=Baixa (menor = mais urgente). Default Normal = 3.
export const PRIORITY_COLORS = { 1: '#E24B4A', 2: '#E0A03B', 3: '#1D9E75', 4: '#74726B' }
export const PRIORITY_LABELS = ['Urgente', 'Alta', 'Normal', 'Baixa']
export const PRIORITY_DEFAULT = 3

export const STATUS_LABELS = { aberta: 'Aberta', aguardando: 'Aguardando', concluida: 'Concluída' }

// id de projeto pode ser 'geral' (string) ou numérico — selects nativos NUNCA podem parseInt cegamente
export const parseProjectId = v => (v === GERAL_ID ? GERAL_ID : Number(v))
// categoria é sempre numérica; '' representa "Sem categoria" (null)
export const parseCategoryId = v => (v === '' || v == null ? null : Number(v))

export function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
