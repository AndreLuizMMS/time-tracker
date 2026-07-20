import { useState, useEffect, useRef, useMemo } from 'react'
import styles from './App.module.css'
import {
  fmtDur, fmtClock, fmtDate, secsToTime,
  localDateStr, todayStr, addDays, csvCell, downloadFile,
} from './lib/format'
import {
  KEYS, GERAL_ID, GERAL, FALLBACK_COLOR, PRIORITY_DEFAULT, SCHEMA_VERSION,
  ENTRY_KINDS, ENTRY_KIND_DEFAULT, STATUS_LABELS,
  loadStorage, saveStorage,
} from './lib/storage'
import { bootstrapState, importData } from './lib/migrate'
import { buildRadar, buildProjectView, buildCola, buildTaskSecs, taskSignals } from './lib/selectors'
import { dedupeTasks, groupEntriesByName } from './lib/dedupe'
import { TimerBar } from './components/TimerBar'
import { RadarBar } from './components/RadarBar'
import { ProjectColumn } from './components/ProjectColumn'
import { ColaDaily } from './components/ColaDaily'
import { ChipPicker } from './components/pickers'
import { EntryGroup, DataMenu, ManualEntryForm, ProjectsManager, CategoriesManager, ColaEditDialog, TaskEditDialog } from './components/managers'

// ─── Opções dos seletores de filtro (módulo-level — não recriar por render) ──
const TASK_STATUS_FILTER_OPTIONS = [
  { id: 'all', name: 'Todos os status' },
  { id: 'aberta', name: STATUS_LABELS.aberta },
  { id: 'aguardando', name: STATUS_LABELS.aguardando },
  { id: 'concluida', name: STATUS_LABELS.concluida },
]
const TASK_DEADLINE_FILTER_OPTIONS = [
  { id: 'all', name: 'Qualquer prazo' },
  { id: 'overdue', name: 'Vencidas' },
  { id: 'today', name: 'Vence hoje' },
  { id: 'has', name: 'Com prazo' },
  { id: 'none', name: 'Sem prazo' },
]
const KIND_FILTER_OPTIONS = [{ id: 'all', name: 'Toda classificação' }, ...ENTRY_KINDS]

const DAILY_GOAL_SECS = 8 * 3600 // meta diária: 8h de trabalho

export default function App() {
  // boot único (migra v1→v2 se preciso, idempotente)
  const boot = useState(bootstrapState)[0]
  const [projects, setProjects] = useState(boot.projects)
  const [categories, setCategories] = useState(boot.categories)
  const [entries, setEntries] = useState(boot.entries)
  const [tasks, setTasks] = useState(boot.tasks)

  useEffect(() => { saveStorage(KEYS.projects, projects) }, [projects])
  useEffect(() => { saveStorage(KEYS.categories, categories) }, [categories])
  useEffect(() => { saveStorage(KEYS.entries, entries) }, [entries])
  useEffect(() => { saveStorage(KEYS.tasks, tasks) }, [tasks])

  // ── lookups ──
  const projById = id => projects.find(p => p.id === id)
  const catById = id => categories.find(c => c.id === id)
  const projName = id => projById(id)?.name ?? 'Geral'
  const projColor = id => projById(id)?.color ?? FALLBACK_COLOR
  const catName = id => (id == null ? 'Sem categoria' : (catById(id)?.name ?? 'Sem categoria'))

  // ── defaults de captura (últimos usados) ──
  const prefs0 = loadStorage('tt_prefs', null)
  const [lastProjectId, setLastProjectId] = useState(prefs0?.projectId ?? GERAL_ID)
  const [lastCategoryId, setLastCategoryId] = useState(prefs0?.categoryId ?? boot.categories[0]?.id ?? null)
  const [theme, setTheme] = useState(prefs0?.theme ?? 'auto') // auto | light | dark
  const [period, setPeriod] = useState(prefs0?.period ?? 'semana')
  useEffect(() => { saveStorage('tt_prefs', { projectId: lastProjectId, categoryId: lastCategoryId, theme, period }) }, [lastProjectId, lastCategoryId, theme, period])
  useEffect(() => {
    const el = document.documentElement
    if (theme === 'auto') el.removeAttribute('data-theme'); else el.dataset.theme = theme
  }, [theme])
  const cycleTheme = () => setTheme(t => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))
  const themeIcon = theme === 'light' ? 'ti-sun' : theme === 'dark' ? 'ti-moon' : 'ti-device-desktop'
  const themeLabel = theme === 'light' ? 'claro' : theme === 'dark' ? 'escuro' : 'automático'
  const rememberCapture = (projectId, categoryId) => { setLastProjectId(projectId); setLastCategoryId(categoryId) }

  // ── toast / undo ──
  const [notice, setNotice] = useState(null)
  const noticeRef = useRef(null)
  const showNotice = msg => { clearTimeout(noticeRef.current); setNotice(msg); noticeRef.current = setTimeout(() => setNotice(null), 2600) }
  const [undoState, setUndoState] = useState(null) // { label, restore }
  const undoTimerRef = useRef(null)
  const pushUndo = (label, restore) => {
    clearTimeout(undoTimerRef.current)
    setUndoState({ label, restore })
    undoTimerRef.current = setTimeout(() => setUndoState(null), 4500)
  }
  const [showHelp, setShowHelp] = useState(false)

  // ── Timer ──
  const savedTimer = useState(() => loadStorage(KEYS.timer, null))[0]
  const [timerActive, setTimerActive] = useState(!!savedTimer?.active)
  const [timerStart, setTimerStart] = useState(savedTimer?.active ? savedTimer.start : null)
  const [timerElapsed, setTimerElapsed] = useState(0)
  const [timerDesc, setTimerDesc] = useState(savedTimer?.active ? (savedTimer.desc || '') : '')
  const [timerProject, setTimerProject] = useState(savedTimer?.active ? (savedTimer.projectId ?? GERAL_ID) : (prefs0?.projectId ?? GERAL_ID))
  const [timerCategory, setTimerCategory] = useState(savedTimer?.active ? (savedTimer.categoryId ?? null) : (prefs0?.categoryId ?? boot.categories[0]?.id ?? null))
  const [timerTaskId, setTimerTaskId] = useState(savedTimer?.active ? (savedTimer.taskId ?? null) : null)
  // classificação default sempre "Tarefa de Projeto" — o usuário troca na barra quando for tarefa pessoal
  const [timerKind, setTimerKind] = useState(savedTimer?.active ? (savedTimer.kind ?? ENTRY_KIND_DEFAULT) : ENTRY_KIND_DEFAULT)
  const tickRef = useRef(null)

  const persistTimer = patch => saveStorage(KEYS.timer, {
    active: true, start: timerStart, desc: timerDesc, projectId: timerProject, categoryId: timerCategory, kind: timerKind, taskId: timerTaskId, ...patch,
  })

  useEffect(() => {
    if (timerActive && timerStart) {
      tickRef.current = setInterval(() => setTimerElapsed(Math.floor((Date.now() - timerStart) / 1000)), 1000)
    } else clearInterval(tickRef.current)
    return () => clearInterval(tickRef.current)
  }, [timerActive, timerStart])

  useEffect(() => {
    document.title = timerActive ? `${fmtDur(timerElapsed)} • MentalMap` : 'MentalMap'
    return () => { document.title = 'MentalMap' }
  }, [timerActive, timerElapsed])

  const startTimer = () => {
    const s = Date.now()
    setTimerStart(s); setTimerActive(true); setTimerElapsed(0); setTimerTaskId(null)
    saveStorage(KEYS.timer, { active: true, start: s, desc: timerDesc, projectId: timerProject, categoryId: timerCategory, kind: timerKind, taskId: null })
  }

  const stopTimer = () => {
    if (timerElapsed < 1) {
      setTimerActive(false); setTimerElapsed(0); setTimerTaskId(null)
      saveStorage(KEYS.timer, { active: false }); showNotice('Timer muito curto — descartado'); return
    }
    const startDate = new Date(timerStart)
    const dateStr = localDateStr(startDate)
    const startSecs = startDate.getHours() * 3600 + startDate.getMinutes() * 60 + startDate.getSeconds()
    const endSecs = (startSecs + timerElapsed) % 86400
    const entry = {
      id: Date.now(), date: dateStr, desc: timerDesc || 'Sem descrição',
      projectId: timerProject, categoryId: timerCategory, kind: timerKind, taskId: timerTaskId,
      start: secsToTime(startSecs), end: secsToTime(endSecs), dur: timerElapsed,
    }
    setEntries(e => [entry, ...e])
    rememberCapture(timerProject, timerCategory)
    setTimerActive(false); setTimerElapsed(0); setTimerDesc(''); setTimerTaskId(null); setTimerKind(ENTRY_KIND_DEFAULT)
    saveStorage(KEYS.timer, { active: false })
  }

  const discardTimer = () => {
    setTimerActive(false); setTimerElapsed(0); setTimerTaskId(null); setTimerKind(ENTRY_KIND_DEFAULT)
    saveStorage(KEYS.timer, { active: false })
    showNotice('Timer descartado')
  }

  const startTimerFromTask = task => {
    if (timerActive) { showNotice('Pare o timer atual primeiro'); return }
    const s = Date.now()
    const cat = task.categoryId ?? lastCategoryId
    setTimerDesc(task.title); setTimerProject(task.projectId); setTimerCategory(cat); setTimerKind(ENTRY_KIND_DEFAULT)
    setTimerStart(s); setTimerActive(true); setTimerElapsed(0); setTimerTaskId(task.id)
    saveStorage(KEYS.timer, { active: true, start: s, desc: task.title, projectId: task.projectId, categoryId: cat, kind: ENTRY_KIND_DEFAULT, taskId: task.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setTimerStartTime = hhmm => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(timerStart ?? Date.now())
    d.setHours(h, m, 0, 0)
    let s = d.getTime()
    if (s > Date.now()) s -= 86400000
    setTimerStart(s); setTimerElapsed(Math.floor((Date.now() - s) / 1000)); persistTimer({ start: s })
  }

  const copyEntryHours = async entry => {
    try { await navigator.clipboard.writeText(fmtClock(entry.dur)); return true } catch { return false }
  }
  // copia o total do grupo (soma dos blocos com o mesmo nome no dia)
  const copyGroupHours = async secs => {
    try { await navigator.clipboard.writeText(fmtClock(secs)); return true } catch { return false }
  }

  const timerStartStr = timerStart
    ? secsToTime(new Date(timerStart).getHours() * 3600 + new Date(timerStart).getMinutes() * 60)
    : '00:00'

  // ── Tarefas duplicadas por nome viram uma só ──
  // Só TAREFAS fundem. Entradas de tempo nunca — dois blocos do mesmo trabalho
  // (manhã e tarde) são fatos distintos; a lista os agrupa visualmente.
  // Idempotente: se nada funde, não toca no estado (sem loop). Pausa com o
  // timer ativo — a tarefa cronometrada não pode ser absorvida no meio.
  useEffect(() => {
    if (timerActive) return
    const r = dedupeTasks(tasks, entries)
    if (!r.mergedTasks) return
    setTasks(r.tasks)
    setEntries(r.entries)
    showNotice(`${r.mergedTasks} tarefa${r.mergedTasks > 1 ? 's' : ''} duplicada${r.mergedTasks > 1 ? 's' : ''} agrupada${r.mergedTasks > 1 ? 's' : ''}`)
  }, [tasks, entries, timerActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tasks (CRUD + máquina de estados) ──
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t))
  const today = todayStr()

  const addTask = (projectId, title) => setTasks(prev => [...prev, {
    id: Date.now(), title, projectId, categoryId: lastCategoryId ?? null,
    priority: PRIORITY_DEFAULT, blocking: false, status: 'aberta', waitingPerson: null, waitingSince: null,
    todayDate: null, deadline: null, createdAt: Date.now(), completedAt: null,
  }])
  const removeTask = id => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    setTasks(prev => prev.filter(t => t.id !== id))
    pushUndo('Tarefa removida', () => setTasks(prev => [...prev, task]))
  }
  const commitTitle = (id, title) => updateTask(id, { title })
  const setPriority = (id, priority) => updateTask(id, { priority })
  const toggleBlocking = id => updateTask(id, t => ({ blocking: !t.blocking }))
  const toggleFocus = id => updateTask(id, t => ({ todayDate: t.todayDate === today ? null : today }))
  const setDeadline = (id, deadline) => updateTask(id, { deadline })
  const setTaskCategory = (id, categoryId) => { updateTask(id, { categoryId }); if (categoryId != null) setLastCategoryId(categoryId) }
  const setTaskProject = (id, projectId) => updateTask(id, { projectId })
  const setWaitingPerson = (id, person) => updateTask(id, { waitingPerson: person })
  const toAguardando = id => updateTask(id, { status: 'aguardando', waitingSince: Date.now(), completedAt: null })
  const toAberta = id => updateTask(id, { status: 'aberta', waitingSince: null, waitingPerson: null, completedAt: null })
  const toConcluida = id => updateTask(id, { status: 'concluida', completedAt: Date.now(), waitingSince: null, waitingPerson: null })
  const reopen = id => updateTask(id, { status: 'aberta', completedAt: null, waitingSince: null, waitingPerson: null })
  // concluir pela UI: se a tarefa está com o cronômetro ativo, para o timer (salva o tempo) antes de concluir
  const completeTask = id => { if (timerActive && timerTaskId === id) stopTimer(); toConcluida(id) }

  // lança um bloco de tempo manual direto numa tarefa (entry de hoje, vinculada à tarefa);
  // compõe o total como qualquer entrada. conclude=true também fecha a tarefa.
  const logTaskTime = (task, secs, conclude) => {
    if (!secs || secs <= 0) return
    const now = new Date()
    const endSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    const startSecs = Math.max(0, endSecs - secs)
    const entry = {
      id: Date.now(), date: localDateStr(now), desc: task.title,
      projectId: task.projectId, categoryId: task.categoryId, kind: ENTRY_KIND_DEFAULT, taskId: task.id,
      start: secsToTime(startSecs), end: secsToTime(endSecs % 86400), dur: secs,
    }
    setEntries(prev => {
      const next = [entry, ...prev]
      next.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
      return next
    })
    if (conclude) toConcluida(task.id)
    showNotice(conclude ? `${fmtClock(secs)} lançado · tarefa concluída` : `${fmtClock(secs)} lançado`)
  }

  // edição completa de tarefa em dialog (aba de projeto)
  const [taskEdit, setTaskEdit] = useState(null)
  const saveTaskEdit = patch => {
    if (!taskEdit) return
    const id = taskEdit.id
    updateTask(id, t => ({
      title: patch.title.trim() || t.title,
      projectId: patch.projectId,
      categoryId: patch.categoryId,
      priority: patch.priority,
      deadline: patch.deadline ?? null,
      blocking: patch.blocking,
      todayDate: patch.focus ? today : null,
    }))
    if (patch.status !== taskEdit.status) {
      if (patch.status === 'aberta') toAberta(id)
      else if (patch.status === 'aguardando') toAguardando(id)
      else if (patch.status === 'concluida') completeTask(id)
    }
    if (patch.status === 'aguardando') setWaitingPerson(id, patch.waitingPerson)
    if (patch.categoryId != null) setLastCategoryId(patch.categoryId)
    setTaskEdit(null)
  }

  const taskActions = {
    setPriority, toggleBlocking, toAberta, toAguardando, toConcluida: completeTask, reopen,
    setWaitingPerson, setDeadline, toggleFocus, setProject: setTaskProject, setCategory: setTaskCategory,
    startTimer: startTimerFromTask, stopTimer, remove: removeTask, commitTitle, logTime: logTaskTime, edit: setTaskEdit,
  }

  // ── Projects CRUD ──
  const addProject = (name, color) => setProjects(prev => [...prev, { id: Date.now(), name, color }])
  const renameProject = (id, name) => { if (id === GERAL_ID) return; setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p)) }
  const recolorProject = (id, color) => setProjects(prev => prev.map(p => p.id === id ? { ...p, color } : p))
  const toggleHiddenProject = id => setProjects(prev => prev.map(p => p.id === id ? { ...p, hidden: !p.hidden } : p))
  const toggleCollapseProject = id => setProjects(prev => prev.map(p => p.id === id ? { ...p, collapsed: !p.collapsed } : p))
  const deleteProject = id => {
    if (id === GERAL_ID) return
    const used = entries.some(e => e.projectId === id) || tasks.some(t => t.projectId === id)
    if (used && !window.confirm('Remover o projeto move seus itens para "Geral". Continuar?')) return
    setEntries(prev => prev.map(e => e.projectId === id ? { ...e, projectId: GERAL_ID } : e))
    setTasks(prev => prev.map(t => t.projectId === id ? { ...t, projectId: GERAL_ID } : t))
    setProjects(prev => prev.filter(p => p.id !== id))
    if (lastProjectId === id) setLastProjectId(GERAL_ID)
  }

  // ── Categories CRUD ──
  const addCategory = (name, color) => setCategories(prev => [...prev, { id: Date.now(), name, color }])
  const renameCategory = (id, name) => setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  const recolorCategory = (id, color) => setCategories(prev => prev.map(c => c.id === id ? { ...c, color } : c))
  const deleteCategory = id => {
    if (categories.length <= 1) { showNotice('Mantenha ao menos uma categoria'); return }
    const used = entries.some(e => e.categoryId === id) || tasks.some(t => t.categoryId === id)
    if (used && !window.confirm('Há itens nesta categoria. Removê-la deixa esses itens sem categoria. Continuar?')) return
    setEntries(prev => prev.map(e => e.categoryId === id ? { ...e, categoryId: null } : e))
    setTasks(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: null } : t))
    setCategories(prev => prev.filter(c => c.id !== id))
    if (lastCategoryId === id) setLastCategoryId(categories.find(c => c.id !== id)?.id ?? null)
  }

  // ── Manual entry ──
  const [showManual, setShowManual] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [projectsManagerOpen, setProjectsManagerOpen] = useState(false)
  const [categoriesManagerOpen, setCategoriesManagerOpen] = useState(false)
  const startEdit = entry => { setEditingEntry(entry); setShowManual(true) }
  const closeManual = () => { setShowManual(false); setEditingEntry(null) }
  const saveManual = data => {
    setEntries(prev => {
      const next = data.id != null
        ? prev.map(x => x.id === data.id ? { ...x, ...data } : x)
        : [{ ...data, id: Date.now() }, ...prev]
      next.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
      return next
    })
    rememberCapture(data.projectId, data.categoryId)
    closeManual()
  }

  // ── Edição rápida pela cola da daily (Nome + data de conclusão) ──
  const [colaEdit, setColaEdit] = useState(null) // { kind: 'task'|'entry', id, title, date, hasDate }
  const openColaEdit = (kind, obj) => {
    if (kind === 'entry') {
      setColaEdit({ kind, id: obj.id, title: obj.desc === 'Sem descrição' ? '' : obj.desc, date: obj.date, hasDate: true })
    } else {
      const date = obj.completedAt ? localDateStr(new Date(obj.completedAt)) : null
      setColaEdit({ kind, id: obj.id, title: obj.title, date, hasDate: obj.status === 'concluida' && !!obj.completedAt })
    }
  }
  const saveColaEdit = ({ title, date }) => {
    const c = colaEdit
    if (!c) return
    const name = title.trim()
    if (c.kind === 'task') {
      updateTask(c.id, t => ({ title: name || t.title, ...(c.hasDate && date ? { completedAt: new Date(date + 'T12:00:00').getTime() } : {}) }))
    } else {
      setEntries(prev => {
        const next = prev.map(x => x.id === c.id ? { ...x, desc: name || 'Sem descrição', date: date || x.date } : x)
        next.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
        return next
      })
    }
    setColaEdit(null)
  }

  // marca/desmarca "adicionado ao Simpli" (lançamento manual em outro software)
  const toggleSimpli = id => setEntries(prev => prev.map(x => x.id === id ? { ...x, simpli: !x.simpli } : x))
  // marca/desmarca o grupo inteiro de uma vez (todos os blocos do mesmo nome no dia)
  const toggleSimpliGroup = (ids, value) => {
    const set = new Set(ids)
    setEntries(prev => prev.map(x => set.has(x.id) ? { ...x, simpli: value } : x))
  }

  const deleteEntry = id => {
    if (editingEntry?.id === id) closeManual()
    const entry = entries.find(x => x.id === id)
    if (!entry) return
    setEntries(e => e.filter(x => x.id !== id))
    pushUndo('Entrada removida', () => setEntries(prev => {
      const next = [...prev, entry]
      next.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
      return next
    }))
  }
  const handleUndo = () => {
    clearTimeout(undoTimerRef.current)
    if (!undoState) return
    undoState.restore()
    setUndoState(null)
  }

  // ── Backup ──
  const exportCsv = () => {
    if (entries.length === 0) { showNotice('Nada para exportar'); return }
    const header = ['Data', 'Início', 'Fim', 'Duração (hh:mm)', 'Projeto', 'Categoria', 'Descrição', 'No Simpli']
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    const lines = [header, ...sorted.map(e => [
      e.date, e.start, e.end, fmtClock(e.dur), projName(e.projectId), catName(e.categoryId), e.desc, e.simpli ? 'Sim' : 'Não',
    ])]
    const csv = '﻿' + lines.map(r => r.map(csvCell).join(';')).join('\r\n')
    downloadFile(`time-tracker-${todayStr()}.csv`, csv, 'text/csv;charset=utf-8')
  }
  const exportJson = () => {
    const data = { version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), projects, categories, entries, tasks }
    downloadFile(`time-tracker-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json')
  }
  const importJson = file => {
    const reader = new FileReader()
    reader.onload = () => {
      let data
      try { data = JSON.parse(reader.result) } catch { showNotice('Arquivo inválido'); return }
      if (!data || (!Array.isArray(data.entries) && !Array.isArray(data.tasks) && !Array.isArray(data.projects))) { showNotice('Backup não reconhecido'); return }
      if (!window.confirm('Importar substitui todos os dados atuais (projetos, categorias, entradas e tarefas). Continuar?')) return
      const next = importData(data)
      setProjects(next.projects); setCategories(next.categories); setEntries(next.entries); setTasks(next.tasks)
      saveStorage(KEYS.schema, { version: SCHEMA_VERSION })
      showNotice('Backup importado')
    }
    reader.readAsText(file)
  }

  // ── Search + filters (lista de entradas) ──
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterProject, setFilterProject] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all') // 'all' | number | null (Sem categoria)
  const [filterKind, setFilterKind] = useState('all') // 'all' | 'projeto' | 'minhas'
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const searchRef = useRef(null)
  const clearFilters = () => { setFilterProject('all'); setFilterCategory('all'); setFilterKind('all'); setFilterFrom(''); setFilterTo('') }
  const hasFilters = filterProject !== 'all' || filterCategory !== 'all' || filterKind !== 'all' || filterFrom || filterTo
  // clica na barra do breakdown → filtra por aquela categoria (toggle)
  const toggleCategoryFilter = id => setFilterCategory(prev => (prev === id ? 'all' : id))
  const toggleKindFilter = id => setFilterKind(prev => (prev === id ? 'all' : id))
  const presets = useMemo(() => {
    const now = new Date(); const t = localDateStr(now); const ws = addDays(now, -now.getDay())
    return [
      { key: 'hoje', label: 'Hoje', from: t, to: t },
      { key: 'ontem', label: 'Ontem', from: localDateStr(addDays(now, -1)), to: localDateStr(addDays(now, -1)) },
      { key: 'semana', label: 'Esta semana', from: localDateStr(ws), to: t },
      { key: 'semana-ant', label: 'Semana passada', from: localDateStr(addDays(ws, -7)), to: localDateStr(addDays(ws, -1)) },
      { key: '15d', label: 'Últimos 15 dias', from: localDateStr(addDays(now, -14)), to: t },
      { key: 'mes', label: 'Este mês', from: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: t },
    ]
  }, [])
  const activePreset = presets.find(p => p.from === filterFrom && p.to === filterTo)?.key
  const applyPreset = p => { setFilterFrom(p.from); setFilterTo(p.to) }

  // ── Keyboard shortcuts ──
  const actionsRef = useRef({})
  actionsRef.current = {
    toggleTimer: () => { if (timerActive) stopTimer(); else startTimer() },
    toggleManual: () => { if (showManual) closeManual(); else { setEditingEntry(null); setShowManual(true); window.scrollTo({ top: 0, behavior: 'smooth' }) } },
    focusSearch: () => searchRef.current?.focus(),
    focusTaskSearch: () => taskSearchRef.current?.focus(),
    toggleHelp: () => setShowHelp(h => !h),
    closeOverlays: () => setShowHelp(false),
  }
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { actionsRef.current.closeOverlays(); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return
      if (e.key === ' ') { e.preventDefault(); actionsRef.current.toggleTimer() }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); actionsRef.current.toggleManual() }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); actionsRef.current.focusTaskSearch() }
      else if (e.key === '/') { e.preventDefault(); actionsRef.current.focusSearch() }
      else if (e.key === '?') { e.preventDefault(); actionsRef.current.toggleHelp() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── KPIs ──
  const todayTotal = entries.filter(e => e.date === today).reduce((s, e) => s + e.dur, 0)
  const weekStartStr = localDateStr(addDays(new Date(), -new Date().getDay()))
  const weekTotal = entries.filter(e => e.date >= weekStartStr).reduce((s, e) => s + e.dur, 0)
  const totalAll = entries.reduce((s, e) => s + e.dur, 0)
  // meta diária de 8h — feito / meta + porcentagem
  const todayLive = timerActive ? todayTotal + timerElapsed : todayTotal
  const goalPct = Math.round((todayLive / DAILY_GOAL_SECS) * 100)
  const goalMet = todayLive >= DAILY_GOAL_SECS

  // ── Period (visão por projeto) — estado em prefs (declarado acima) ──
  const periodRange = useMemo(() => {
    const now = new Date(); const t = localDateStr(now)
    if (period === 'hoje') return { from: t, to: t, label: 'hoje' }
    if (period === 'total') return { from: null, to: null, label: 'total' }
    return { from: localDateStr(addDays(now, -now.getDay())), to: t, label: 'na semana' }
  }, [period])

  // ── Busca + filtros de tarefa (visão por projeto) ──
  const [taskSearch, setTaskSearch] = useState('')
  const [taskFiltersOpen, setTaskFiltersOpen] = useState(false)
  const [taskFilterStatus, setTaskFilterStatus] = useState('all')     // all | aberta | aguardando | concluida
  const [taskFilterCategory, setTaskFilterCategory] = useState('all') // all | number | null (Sem categoria)
  const [taskFilterDeadline, setTaskFilterDeadline] = useState('all') // all | overdue | today | has | none
  const [taskFilterBlocking, setTaskFilterBlocking] = useState(false)
  const taskSearchRef = useRef(null)
  // dia do bloco "fiz" da cola; null = último dia de trabalho (automático)
  const [colaDay, setColaDay] = useState(null)
  const hasTaskFilters = taskFilterStatus !== 'all' || taskFilterCategory !== 'all' || taskFilterDeadline !== 'all' || taskFilterBlocking
  const clearTaskFilters = () => { setTaskFilterStatus('all'); setTaskFilterCategory('all'); setTaskFilterDeadline('all'); setTaskFilterBlocking(false) }
  const taskFilterActive = taskSearch.trim() !== '' || hasTaskFilters
  const tq = taskSearch.toLowerCase().trim()
  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (tq && !t.title.toLowerCase().includes(tq)) return false
    if (taskFilterStatus !== 'all' && t.status !== taskFilterStatus) return false
    if (taskFilterCategory !== 'all' && t.categoryId !== taskFilterCategory) return false
    if (taskFilterBlocking && !t.blocking) return false
    if (taskFilterDeadline !== 'all') {
      const ds = taskSignals(t, today).deadlineState
      if (taskFilterDeadline === 'overdue' && ds !== 'overdue') return false
      if (taskFilterDeadline === 'today' && ds !== 'today') return false
      if (taskFilterDeadline === 'has' && t.deadline == null) return false
      if (taskFilterDeadline === 'none' && t.deadline != null) return false
    }
    return true
  }), [tasks, tq, taskFilterStatus, taskFilterCategory, taskFilterDeadline, taskFilterBlocking, today])

  // ── Derived selectors ──
  const radar = useMemo(() => buildRadar(tasks, today), [tasks, today])
  const taskSecs = useMemo(() => buildTaskSecs(entries), [entries])
  const projectVMs = useMemo(() => buildProjectView(projects, filteredTasks, entries, today, periodRange.from, periodRange.to, { includePastCompleted: taskFilterActive }), [projects, filteredTasks, entries, today, periodRange, taskFilterActive])
  const visibleVMs = taskFilterActive
    ? projectVMs.filter(vm => vm.abertas.length || vm.aguardando.length || vm.concluidasHoje.length || vm.concluidasPassadas.length)
    : projectVMs
  const cola = useMemo(() => buildCola(tasks, entries, today, colaDay), [tasks, entries, today, colaDay])
  const hiddenCount = projects.filter(p => p.hidden).length
  const allCollapsed = projectVMs.length > 0 && projectVMs.every(vm => vm.project.collapsed)
  const toggleAllCollapsed = () => setProjects(prev => prev.map(p => (p.hidden ? p : { ...p, collapsed: !allCollapsed })))

  // ── Entradas: filtro + agrupamento + breakdown por categoria ──
  const q = searchQuery.toLowerCase().trim()
  // base = tudo menos o filtro de categoria → mantém TODAS as barras do breakdown visíveis/clicáveis
  const baseFiltered = entries.filter(e => {
    if (q && !e.desc.toLowerCase().includes(q)) return false
    if (filterProject !== 'all' && e.projectId !== filterProject) return false
    if (filterFrom && e.date < filterFrom) return false
    if (filterTo && e.date > filterTo) return false
    return true
  })
  // classificação e categoria são eixos independentes: cada breakdown ignora o próprio filtro
  // (mantém todas as barras clicáveis) mas respeita o do outro eixo. a lista respeita ambos.
  const afterKind = filterKind === 'all' ? baseFiltered : baseFiltered.filter(e => e.kind === filterKind)
  const afterCat = filterCategory === 'all' ? baseFiltered : baseFiltered.filter(e => e.categoryId === filterCategory)
  const filteredEntries = filterCategory === 'all' ? afterKind : afterKind.filter(e => e.categoryId === filterCategory)
  const grouped = filteredEntries.reduce((acc, e) => { (acc[e.date] = acc[e.date] || []).push(e); return acc }, {})
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const catTotals = useMemo(() => {
    const map = new Map()
    afterKind.forEach(e => map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.dur))
    const arr = [...map.entries()].map(([id, dur]) => ({ id, dur, name: catName(id), color: catById(id)?.color ?? FALLBACK_COLOR }))
    arr.sort((a, b) => b.dur - a.dur)
    return arr
  }, [afterKind]) // eslint-disable-line react-hooks/exhaustive-deps
  const breakdownMax = catTotals[0]?.dur || 1
  const breakdownTotal = catTotals.reduce((s, p) => s + p.dur, 0)
  const kindTotals = useMemo(() => {
    const map = new Map()
    afterCat.forEach(e => map.set(e.kind, (map.get(e.kind) || 0) + e.dur))
    return ENTRY_KINDS.filter(k => map.has(k.id)).map(k => ({ id: k.id, name: k.name, color: k.color, dur: map.get(k.id) }))
  }, [afterCat]) // eslint-disable-line react-hooks/exhaustive-deps
  const kindMax = Math.max(1, ...kindTotals.map(k => k.dur))
  const kindTotal = kindTotals.reduce((s, k) => s + k.dur, 0)

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}><i className="ti ti-brain" aria-hidden="true" /></span>
            <span>MentalMap</span>
          </div>
          <div className={styles.headerStats}>
            <div className={`${styles.kpi} ${styles.kpiPrimary} ${styles.kpiGoal} ${goalMet ? styles.kpiGoalMet : ''}`}>
              <span className={styles.kpiLabel}>Hoje · meta {fmtClock(DAILY_GOAL_SECS)}</span>
              <span className={styles.kpiValue}>
                {fmtClock(todayLive)}<span className={styles.kpiGoalTarget}> / {fmtClock(DAILY_GOAL_SECS)}</span>
                <span className={styles.kpiGoalPct}>{goalMet && <i className="ti ti-circle-check" aria-hidden="true" />}{goalPct}%</span>
              </span>
              <div className={styles.goalBar} role="progressbar" aria-valuenow={Math.min(100, goalPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta diária">
                <div className={styles.goalBarFill} style={{ width: `${Math.min(100, goalPct)}%` }} />
              </div>
            </div>
            <span className={styles.kpiDivider} aria-hidden="true" />
            <div className={styles.kpi}><span className={styles.kpiLabel}>Semana</span><span className={styles.kpiValue}>{fmtClock(weekTotal)}</span></div>
            <span className={styles.kpiDivider} aria-hidden="true" />
            <div className={styles.kpi}><span className={styles.kpiLabel}>Total</span><span className={styles.kpiValue}>{fmtClock(totalAll)}</span></div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.iconBtn} onClick={cycleTheme} aria-label={`Tema: ${themeLabel}`} title={`Tema: ${themeLabel} (clique p/ alternar)`}>
              <i className={`ti ${themeIcon}`} aria-hidden="true" />
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => setShowHelp(true)} aria-label="Atalhos de teclado" title="Atalhos de teclado (?)">
              <i className="ti ti-keyboard" aria-hidden="true" />
            </button>
            <DataMenu onExportCsv={exportCsv} onExportJson={exportJson} onImport={importJson} />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <TimerBar
          active={timerActive} elapsed={timerElapsed} desc={timerDesc}
          projectId={timerProject} categoryId={timerCategory} kindId={timerKind} projects={projects} categories={categories}
          startStr={timerStartStr}
          onDescChange={v => { setTimerDesc(v); if (timerActive) persistTimer({ desc: v }) }}
          onProjectChange={v => { setTimerProject(v); if (timerActive) persistTimer({ projectId: v }) }}
          onCategoryChange={v => { setTimerCategory(v); if (timerActive) persistTimer({ categoryId: v }) }}
          onKindChange={v => { setTimerKind(v); if (timerActive) persistTimer({ kind: v }) }}
          onStart={startTimer} onStop={stopTimer} onDiscard={discardTimer} onStartTimeChange={setTimerStartTime}
        />

        <RadarBar radar={radar} projById={projById} today={today} timerActive={timerActive} timerTaskId={timerTaskId}
          onComplete={t => completeTask(t.id)} onBringBack={t => toAberta(t.id)} onStartTimer={startTimerFromTask} onStop={stopTimer} onRemoveFocus={t => toggleFocus(t.id)} />

        {/* ── Visão por projeto ── */}
        <section className={styles.projectsZone}>
          <div className={styles.projectsZoneHead}>
            <span className={styles.sectionLabel} style={{ marginBottom: 0 }}>Projetos</span>
            {projectVMs.length > 0 && (
              <button type="button" className={styles.collapseAll} onClick={toggleAllCollapsed} title={allCollapsed ? 'Expandir todos' : 'Recolher todos'}>
                <i className={`ti ${allCollapsed ? 'ti-chevrons-down' : 'ti-chevrons-up'}`} aria-hidden="true" />
                {allCollapsed ? 'Expandir todos' : 'Recolher todos'}
              </button>
            )}
            <div className={styles.periodToggle}>
              {['hoje', 'semana', 'total'].map(p => (
                <button key={p} type="button" className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
            {hiddenCount > 0 && (
              <button type="button" className={styles.showHidden} onClick={() => setProjects(prev => prev.map(p => ({ ...p, hidden: false })))}>
                <i className="ti ti-eye" aria-hidden="true" />{hiddenCount} oculto{hiddenCount > 1 ? 's' : ''}
              </button>
            )}
            <div className={styles.entriesTools} style={{ marginLeft: 'auto' }}>
              <button className={`${styles.filterToggle} ${taskFiltersOpen || hasTaskFilters ? styles.filterToggleOn : ''}`} onClick={() => setTaskFiltersOpen(o => !o)} aria-label="Filtros de tarefa" aria-expanded={taskFiltersOpen} title="Filtros de tarefa">
                <i className="ti ti-filter" aria-hidden="true" />{hasTaskFilters && <span className={styles.filterDot} aria-hidden="true" />}
              </button>
              <div className={styles.searchBar}>
                <i className="ti ti-search" aria-hidden="true" />
                <input ref={taskSearchRef} className={styles.searchInput} placeholder="Buscar tarefa..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} aria-label="Buscar tarefas" />
                {taskSearch && <button className={styles.searchClear} onClick={() => setTaskSearch('')} aria-label="Limpar busca"><i className="ti ti-x" aria-hidden="true" /></button>}
              </div>
            </div>
          </div>

          {taskFiltersOpen && (
            <div className={styles.filterPanel}>
              <div className={styles.filterRow}>
                <ChipPicker value={taskFilterStatus} options={TASK_STATUS_FILTER_OPTIONS} onChange={setTaskFilterStatus} icon="ti-progress-check" title="Filtrar por status" block />
                <ChipPicker
                  value={taskFilterCategory === 'all' ? 'all' : taskFilterCategory === null ? '__none__' : taskFilterCategory}
                  options={[{ id: 'all', name: 'Todas as categorias' }, ...categories, { id: '__none__', name: 'Sem categoria' }]}
                  onChange={v => setTaskFilterCategory(v === 'all' ? 'all' : v === '__none__' ? null : v)}
                  icon="ti-tag" title="Filtrar por categoria" block
                />
                <ChipPicker value={taskFilterDeadline} options={TASK_DEADLINE_FILTER_OPTIONS} onChange={setTaskFilterDeadline} icon="ti-calendar-due" title="Filtrar por prazo" block />
                <button type="button" className={`${styles.presetChip} ${taskFilterBlocking ? styles.presetChipActive : ''}`} onClick={() => setTaskFilterBlocking(b => !b)} aria-pressed={taskFilterBlocking}>
                  <i className="ti ti-alert-octagon" aria-hidden="true" /> Só bloqueantes
                </button>
                {hasTaskFilters && <button className={styles.filterClear} onClick={clearTaskFilters}><i className="ti ti-x" aria-hidden="true" />Limpar</button>}
              </div>
            </div>
          )}

          {visibleVMs.length === 0 ? (
            <p className={styles.projectEmpty}>{taskFilterActive ? 'Nenhuma tarefa encontrada.' : 'Sem projetos.'}</p>
          ) : (
            <div className={styles.projectsRow}>
              {visibleVMs.map(vm => (
                <ProjectColumn key={vm.project.id} vm={vm} categories={categories} projects={projects} today={today}
                  timerActive={timerActive} actions={taskActions} periodLabel={periodRange.label}
                  secsByTask={taskSecs} timerTaskId={timerTaskId} timerElapsed={timerElapsed}
                  onToggleCollapse={toggleCollapseProject} onQuickAdd={addTask} />
              ))}
            </div>
          )}
        </section>

        {/* ── Zona inferior: cola + gerenciadores | entradas ── */}
        <div className={styles.lower}>
          <div className={styles.lowerLeft}>
            <ColaDaily cola={cola} projects={projects} today={today} timerActive={timerActive} timerTaskId={timerTaskId}
              selectedDay={colaDay} onSelectDay={setColaDay} onEditItem={openColaEdit}
              onStartTimer={startTimerFromTask} onStop={stopTimer} onComplete={completeTask} />
            <ProjectsManager projects={projects} open={projectsManagerOpen} onToggle={() => setProjectsManagerOpen(o => !o)}
              onAdd={addProject} onRename={renameProject} onRecolor={recolorProject} onDelete={deleteProject} onToggleHidden={toggleHiddenProject} />
            <CategoriesManager categories={categories} open={categoriesManagerOpen} onToggle={() => setCategoriesManagerOpen(o => !o)}
              onAdd={addCategory} onRename={renameCategory} onRecolor={recolorCategory} onDelete={deleteCategory} />
          </div>

          <div className={styles.lowerRight}>
            <button className={`${styles.manualToggle} ${showManual ? styles.manualToggleOpen : ''}`} onClick={() => { if (showManual) closeManual(); else { setEditingEntry(null); setShowManual(true) } }}>
              <i className="ti ti-clock-plus" aria-hidden="true" />Adicionar horário manual
              <i className={`ti ti-chevron-down ${styles.chevron}`} aria-hidden="true" />
            </button>

            {showManual && (
              <ManualEntryForm key={editingEntry?.id ?? 'new'} editing={editingEntry} projects={projects} categories={categories}
                defaultProjectId={lastProjectId} defaultCategoryId={lastCategoryId} entries={entries} onSave={saveManual} onCancel={closeManual} />
            )}

            {entries.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}><i className="ti ti-clock-hour-3" aria-hidden="true" /></span>
                <div className={styles.emptyTitle}>Nenhuma entrada ainda</div>
                <p className={styles.emptyText}>Inicie o timer ou adicione um horário manual para começar a registrar seu tempo.</p>
              </div>
            ) : (
              <div>
                <div className={styles.entriesHeader}>
                  <span className={styles.sectionLabel} style={{ marginBottom: 0 }}>Entradas</span>
                  <div className={styles.entriesTools}>
                    <button className={`${styles.filterToggle} ${filtersOpen || hasFilters ? styles.filterToggleOn : ''}`} onClick={() => setFiltersOpen(o => !o)} aria-label="Filtros" aria-expanded={filtersOpen} title="Filtros">
                      <i className="ti ti-filter" aria-hidden="true" />{hasFilters && <span className={styles.filterDot} aria-hidden="true" />}
                    </button>
                    <div className={styles.searchBar}>
                      <i className="ti ti-search" aria-hidden="true" />
                      <input ref={searchRef} className={styles.searchInput} placeholder="Buscar... ( / )" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} aria-label="Buscar entradas" />
                      {searchQuery && <button className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Limpar busca"><i className="ti ti-x" aria-hidden="true" /></button>}
                    </div>
                  </div>
                </div>

                {filtersOpen && (
                  <div className={styles.filterPanel}>
                    <div className={styles.filterPresets}>
                      {presets.map(p => (
                        <button key={p.key} type="button" className={`${styles.presetChip} ${activePreset === p.key ? styles.presetChipActive : ''}`} onClick={() => applyPreset(p)}>{p.label}</button>
                      ))}
                    </div>
                    <div className={styles.filterRow}>
                      <ChipPicker
                        value={filterProject}
                        options={[{ id: 'all', name: 'Todos os projetos' }, ...projects]}
                        onChange={setFilterProject}
                        icon="ti-folder" title="Filtrar por projeto" block
                      />
                      <ChipPicker
                        value={filterCategory === 'all' ? 'all' : filterCategory === null ? '__none__' : filterCategory}
                        options={[{ id: 'all', name: 'Todas as categorias' }, ...categories, { id: '__none__', name: 'Sem categoria' }]}
                        onChange={v => setFilterCategory(v === 'all' ? 'all' : v === '__none__' ? null : v)}
                        icon="ti-tag" title="Filtrar por categoria" block
                      />
                      <ChipPicker value={filterKind} options={KIND_FILTER_OPTIONS} onChange={setFilterKind} icon="ti-tag" title="Filtrar por classificação" block />
                      <input type="date" className={styles.dateInput} value={filterFrom} max={filterTo || undefined} onChange={e => setFilterFrom(e.target.value)} aria-label="Data inicial" />
                      <span className={styles.filterSep}>até</span>
                      <input type="date" className={styles.dateInput} value={filterTo} min={filterFrom || undefined} onChange={e => setFilterTo(e.target.value)} aria-label="Data final" />
                      {hasFilters && <button className={styles.filterClear} onClick={clearFilters}><i className="ti ti-x" aria-hidden="true" />Limpar</button>}
                    </div>
                  </div>
                )}

                {sortedDays.length === 0 ? (
                  <div className={styles.noResults}><i className="ti ti-search-off" aria-hidden="true" />Nenhum resultado{q ? ` para “${searchQuery}”` : ''}</div>
                ) : (
                  <>
                    {kindTotals.length > 1 && (
                      <div className={styles.breakdown}>
                        <div className={styles.breakdownHead}><span className={styles.breakdownTitle}>Por classificação</span><span className={styles.breakdownSum}>{fmtClock(kindTotal)}</span></div>
                        {kindTotals.map(k => (
                          <button
                            key={k.id}
                            type="button"
                            className={`${styles.breakdownRow} ${filterKind === k.id ? styles.breakdownRowActive : ''} ${filterKind !== 'all' && filterKind !== k.id ? styles.breakdownRowDim : ''}`}
                            onClick={() => toggleKindFilter(k.id)}
                            title={filterKind === k.id ? 'Remover filtro' : `Ver ${k.name}`}
                          >
                            <span className={styles.breakdownName}><span className={styles.breakdownDot} style={{ background: k.color }} aria-hidden="true" />{k.name}</span>
                            <div className={styles.breakdownTrack}><div className={styles.breakdownBar} style={{ width: `${(k.dur / kindMax) * 100}%`, background: k.color }} /></div>
                            <span className={styles.breakdownVal}>{fmtClock(k.dur)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {catTotals.length > 1 && (
                      <div className={styles.breakdown}>
                        <div className={styles.breakdownHead}><span className={styles.breakdownTitle}>Por categoria</span><span className={styles.breakdownSum}>{fmtClock(breakdownTotal)}</span></div>
                        {catTotals.map(p => (
                          <button
                            key={p.id ?? 'none'}
                            type="button"
                            className={`${styles.breakdownRow} ${filterCategory === p.id ? styles.breakdownRowActive : ''} ${filterCategory !== 'all' && filterCategory !== p.id ? styles.breakdownRowDim : ''}`}
                            onClick={() => toggleCategoryFilter(p.id)}
                            title={filterCategory === p.id ? 'Remover filtro' : `Ver atividades de ${p.name}`}
                          >
                            <span className={styles.breakdownName}><span className={styles.breakdownDot} style={{ background: p.color }} aria-hidden="true" />{p.name}</span>
                            <div className={styles.breakdownTrack}><div className={styles.breakdownBar} style={{ width: `${(p.dur / breakdownMax) * 100}%`, background: p.color }} /></div>
                            <span className={styles.breakdownVal}>{fmtClock(p.dur)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {sortedDays.map(day => (
                      <div className={styles.dayGroup} key={day}>
                        <div className={styles.dayHeader}>
                          <span className={styles.dayName}>{fmtDate(day)}</span>
                          <span className={styles.dayTotal}>{fmtClock(grouped[day].reduce((s, e) => s + e.dur, 0))}</span>
                        </div>
                        {groupEntriesByName(grouped[day]).map(group => (
                          <EntryGroup key={group.key} group={group}
                            project={{ name: projName(group.lead.projectId), color: projColor(group.lead.projectId) }}
                            catName={catName}
                            editingId={editingEntry?.id}
                            onEdit={startEdit} onDelete={deleteEntry}
                            onCopy={copyEntryHours} onCopyTotal={copyGroupHours} onToggleSimpli={toggleSimpli} onToggleSimpliAll={toggleSimpliGroup} />
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {undoState && (
        <div className={styles.undoToast} role="status">
          <span className={styles.undoMsg}><i className="ti ti-trash" aria-hidden="true" />{undoState.label}</span>
          <button className={styles.undoBtn} onClick={handleUndo}>Desfazer</button>
        </div>
      )}
      {notice && (
        <div className={styles.noticeToast} role="status"><i className="ti ti-info-circle" aria-hidden="true" />{notice}</div>
      )}

      {colaEdit && (
        <ColaEditDialog item={colaEdit} onSave={saveColaEdit} onCancel={() => setColaEdit(null)} />
      )}

      {taskEdit && (
        <TaskEditDialog task={taskEdit} categories={categories} projects={projects} today={today}
          onSave={saveTaskEdit} onCancel={() => setTaskEdit(null)} />
      )}

      {showHelp && (
        <div className={styles.helpOverlay} role="dialog" aria-modal="true" aria-label="Atalhos de teclado" onClick={() => setShowHelp(false)}>
          <div className={styles.helpModal} onClick={e => e.stopPropagation()}>
            <div className={styles.helpHead}>
              <span className={styles.helpTitle}><i className="ti ti-keyboard" aria-hidden="true" />Atalhos de teclado</span>
              <button type="button" className={styles.iconBtn} onClick={() => setShowHelp(false)} aria-label="Fechar"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <ul className={styles.helpList}>
              {[
                ['Espaço', 'Iniciar / parar o timer'],
                ['M', 'Adicionar horário manual'],
                ['T', 'Buscar tarefas'],
                ['/', 'Buscar entradas'],
                ['?', 'Mostrar esta ajuda'],
                ['Esc', 'Fechar ajuda / popovers'],
              ].map(([k, d]) => (
                <li key={k} className={styles.helpRow}><kbd className={styles.helpKbd}>{k}</kbd><span>{d}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
