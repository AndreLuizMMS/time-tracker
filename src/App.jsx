import { useState, useEffect, useRef, useMemo } from 'react'
import styles from './App.module.css'
import {
  fmtDur, fmtHoursDec, fmtDate, timeToSecs, secsToTime,
  localDateStr, todayStr, addDays, csvCell, downloadFile,
} from './lib/format'
import {
  KEYS, GERAL_ID, GERAL, FALLBACK_COLOR, PRIORITY_DEFAULT, SCHEMA_VERSION,
  loadStorage, saveStorage, parseProjectId,
} from './lib/storage'
import { bootstrapState, importData } from './lib/migrate'
import { buildRadar, buildProjectView, buildCola, buildTaskSecs, taskSignals } from './lib/selectors'
import { TimerBar } from './components/TimerBar'
import { RadarBar } from './components/RadarBar'
import { ProjectColumn } from './components/ProjectColumn'
import { ColaDaily } from './components/ColaDaily'
import { EntryRow, DataMenu, ManualEntryForm, ProjectsManager, CategoriesManager } from './components/managers'

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
  const [timerResumeId, setTimerResumeId] = useState(savedTimer?.active ? (savedTimer.resumeId ?? null) : null)
  const [timerTaskId, setTimerTaskId] = useState(savedTimer?.active ? (savedTimer.taskId ?? null) : null)
  const tickRef = useRef(null)

  const persistTimer = patch => saveStorage(KEYS.timer, {
    active: true, start: timerStart, desc: timerDesc, projectId: timerProject, categoryId: timerCategory, resumeId: timerResumeId, taskId: timerTaskId, ...patch,
  })

  useEffect(() => {
    if (timerActive && timerStart) {
      tickRef.current = setInterval(() => setTimerElapsed(Math.floor((Date.now() - timerStart) / 1000)), 1000)
    } else clearInterval(tickRef.current)
    return () => clearInterval(tickRef.current)
  }, [timerActive, timerStart])

  useEffect(() => {
    document.title = timerActive ? `${fmtDur(timerElapsed)} • Time Tracker` : 'Time Tracker'
    return () => { document.title = 'Time Tracker' }
  }, [timerActive, timerElapsed])

  const startTimer = () => {
    const s = Date.now()
    setTimerStart(s); setTimerActive(true); setTimerElapsed(0); setTimerTaskId(null)
    saveStorage(KEYS.timer, { active: true, start: s, desc: timerDesc, projectId: timerProject, categoryId: timerCategory, resumeId: null, taskId: null })
  }

  const stopTimer = () => {
    if (timerElapsed < 1) {
      setTimerActive(false); setTimerElapsed(0); setTimerResumeId(null); setTimerTaskId(null)
      saveStorage(KEYS.timer, { active: false }); showNotice('Timer muito curto — descartado'); return
    }
    const startDate = new Date(timerStart)
    const dateStr = localDateStr(startDate)
    const startSecs = startDate.getHours() * 3600 + startDate.getMinutes() * 60 + startDate.getSeconds()
    const endSecs = (startSecs + timerElapsed) % 86400
    if (timerResumeId !== null) {
      setEntries(prev => prev.map(x => {
        if (x.id !== timerResumeId) return x
        const end = secsToTime((timeToSecs(x.start) + timerElapsed) % 86400)
        return { ...x, desc: timerDesc || 'Sem descrição', projectId: timerProject, categoryId: timerCategory, end, dur: timerElapsed }
      }))
    } else {
      const entry = {
        id: Date.now(), date: dateStr, desc: timerDesc || 'Sem descrição',
        projectId: timerProject, categoryId: timerCategory, taskId: timerTaskId,
        start: secsToTime(startSecs), end: secsToTime(endSecs), dur: timerElapsed,
      }
      setEntries(e => [entry, ...e])
    }
    rememberCapture(timerProject, timerCategory)
    setTimerActive(false); setTimerElapsed(0); setTimerDesc(''); setTimerResumeId(null); setTimerTaskId(null)
    saveStorage(KEYS.timer, { active: false })
  }

  const discardTimer = () => {
    setTimerActive(false); setTimerElapsed(0); setTimerResumeId(null); setTimerTaskId(null)
    saveStorage(KEYS.timer, { active: false })
    showNotice('Timer descartado')
  }

  const resumeEntry = entry => {
    if (timerActive) { showNotice('Pare o timer atual primeiro'); return }
    const s = Date.now() - entry.dur * 1000
    setTimerDesc(entry.desc === 'Sem descrição' ? '' : entry.desc)
    setTimerProject(entry.projectId); setTimerCategory(entry.categoryId); setTimerResumeId(entry.id); setTimerTaskId(entry.taskId ?? null)
    setTimerStart(s); setTimerElapsed(entry.dur); setTimerActive(true)
    saveStorage(KEYS.timer, { active: true, start: s, desc: entry.desc, projectId: entry.projectId, categoryId: entry.categoryId, resumeId: entry.id, taskId: entry.taskId ?? null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startTimerFromTask = task => {
    if (timerActive) { showNotice('Pare o timer atual primeiro'); return }
    const s = Date.now()
    const cat = task.categoryId ?? lastCategoryId
    setTimerDesc(task.title); setTimerProject(task.projectId); setTimerCategory(cat)
    setTimerStart(s); setTimerActive(true); setTimerElapsed(0); setTimerResumeId(null); setTimerTaskId(task.id)
    saveStorage(KEYS.timer, { active: true, start: s, desc: task.title, projectId: task.projectId, categoryId: cat, resumeId: null, taskId: task.id })
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
    try { await navigator.clipboard.writeText(fmtHoursDec(entry.dur).replace('h', '')); return true } catch { return false }
  }

  const timerStartStr = timerStart
    ? secsToTime(new Date(timerStart).getHours() * 3600 + new Date(timerStart).getMinutes() * 60)
    : '00:00'

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

  const taskActions = {
    setPriority, toggleBlocking, toAberta, toAguardando, toConcluida, reopen,
    setWaitingPerson, setDeadline, toggleFocus, setProject: setTaskProject, setCategory: setTaskCategory,
    startTimer: startTimerFromTask, remove: removeTask, commitTitle,
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
  const manualRef = useRef(null)
  const startEdit = entry => { setEditingEntry(entry); setShowManual(true) }
  const closeManual = () => { setShowManual(false); setEditingEntry(null) }
  // ao editar, traz o formulário pro campo de visão suavemente (sem pular pro topo absoluto)
  useEffect(() => {
    if (showManual && editingEntry) manualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [showManual, editingEntry])
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
    const header = ['Data', 'Início', 'Fim', 'Duração (h)', 'Projeto', 'Categoria', 'Descrição']
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    const lines = [header, ...sorted.map(e => [
      e.date, e.start, e.end, (e.dur / 3600).toFixed(2).replace('.', ','), projName(e.projectId), catName(e.categoryId), e.desc,
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
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const searchRef = useRef(null)
  const clearFilters = () => { setFilterProject('all'); setFilterCategory('all'); setFilterFrom(''); setFilterTo('') }
  const hasFilters = filterProject !== 'all' || filterCategory !== 'all' || filterFrom || filterTo
  // clica na barra do breakdown → filtra por aquela categoria (toggle)
  const toggleCategoryFilter = id => setFilterCategory(prev => (prev === id ? 'all' : id))
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
  const cola = useMemo(() => buildCola(tasks, entries, today), [tasks, entries, today])
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
  const filteredEntries = filterCategory === 'all' ? baseFiltered : baseFiltered.filter(e => e.categoryId === filterCategory)
  const grouped = filteredEntries.reduce((acc, e) => { (acc[e.date] = acc[e.date] || []).push(e); return acc }, {})
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const catTotals = useMemo(() => {
    const map = new Map()
    baseFiltered.forEach(e => map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.dur))
    const arr = [...map.entries()].map(([id, dur]) => ({ id, dur, name: catName(id), color: catById(id)?.color ?? FALLBACK_COLOR }))
    arr.sort((a, b) => b.dur - a.dur)
    return arr
  }, [baseFiltered]) // eslint-disable-line react-hooks/exhaustive-deps
  const breakdownMax = catTotals[0]?.dur || 1
  const breakdownTotal = catTotals.reduce((s, p) => s + p.dur, 0)

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}><i className="ti ti-radar-2" aria-hidden="true" /></span>
            <span>Time Tracker</span>
          </div>
          <div className={styles.headerStats}>
            <div className={`${styles.kpi} ${styles.kpiPrimary} ${styles.kpiGoal} ${goalMet ? styles.kpiGoalMet : ''}`}>
              <span className={styles.kpiLabel}>Hoje · meta {fmtHoursDec(DAILY_GOAL_SECS)}</span>
              <span className={styles.kpiValue}>
                {fmtHoursDec(todayLive)}<span className={styles.kpiGoalTarget}> / {fmtHoursDec(DAILY_GOAL_SECS)}</span>
                <span className={styles.kpiGoalPct}>{goalMet && <i className="ti ti-circle-check" aria-hidden="true" />}{goalPct}%</span>
              </span>
              <div className={styles.goalBar} role="progressbar" aria-valuenow={Math.min(100, goalPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta diária">
                <div className={styles.goalBarFill} style={{ width: `${Math.min(100, goalPct)}%` }} />
              </div>
            </div>
            <span className={styles.kpiDivider} aria-hidden="true" />
            <div className={styles.kpi}><span className={styles.kpiLabel}>Semana</span><span className={styles.kpiValue}>{fmtHoursDec(weekTotal)}</span></div>
            <span className={styles.kpiDivider} aria-hidden="true" />
            <div className={styles.kpi}><span className={styles.kpiLabel}>Total</span><span className={styles.kpiValue}>{fmtHoursDec(totalAll)}</span></div>
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
          projectId={timerProject} categoryId={timerCategory} projects={projects} categories={categories}
          startStr={timerStartStr}
          onDescChange={v => { setTimerDesc(v); if (timerActive) persistTimer({ desc: v }) }}
          onProjectChange={v => { setTimerProject(v); if (timerActive) persistTimer({ projectId: v }) }}
          onCategoryChange={v => { setTimerCategory(v); if (timerActive) persistTimer({ categoryId: v }) }}
          onStart={startTimer} onStop={stopTimer} onDiscard={discardTimer} onStartTimeChange={setTimerStartTime}
        />

        <RadarBar radar={radar} projById={projById} today={today} timerActive={timerActive}
          onComplete={t => toConcluida(t.id)} onBringBack={t => toAberta(t.id)} onStartTimer={startTimerFromTask} />

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
                <div className={styles.selectWrap}>
                  <select className={styles.formSelect} value={taskFilterStatus} onChange={e => setTaskFilterStatus(e.target.value)} aria-label="Filtrar por status">
                    <option value="all">Todos os status</option>
                    <option value="aberta">Aberta</option>
                    <option value="aguardando">Aguardando</option>
                    <option value="concluida">Concluída</option>
                  </select>
                  <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
                </div>
                <div className={styles.selectWrap}>
                  <select className={styles.formSelect} value={taskFilterCategory === 'all' ? 'all' : taskFilterCategory === null ? '__none__' : taskFilterCategory} onChange={e => { const v = e.target.value; setTaskFilterCategory(v === 'all' ? 'all' : v === '__none__' ? null : Number(v)) }} aria-label="Filtrar por categoria">
                    <option value="all">Todas as categorias</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="__none__">Sem categoria</option>
                  </select>
                  <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
                </div>
                <div className={styles.selectWrap}>
                  <select className={styles.formSelect} value={taskFilterDeadline} onChange={e => setTaskFilterDeadline(e.target.value)} aria-label="Filtrar por prazo">
                    <option value="all">Qualquer prazo</option>
                    <option value="overdue">Vencidas</option>
                    <option value="today">Vence hoje</option>
                    <option value="has">Com prazo</option>
                    <option value="none">Sem prazo</option>
                  </select>
                  <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
                </div>
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
            <ColaDaily cola={cola} projects={projects} today={today} timerActive={timerActive}
              onStartTimer={startTimerFromTask} onComplete={toConcluida} />
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
              <div ref={manualRef}>
                <ManualEntryForm key={editingEntry?.id ?? 'new'} editing={editingEntry} projects={projects} categories={categories}
                  defaultProjectId={lastProjectId} defaultCategoryId={lastCategoryId} entries={entries} onSave={saveManual} onCancel={closeManual} />
              </div>
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
                      <div className={styles.selectWrap}>
                        <select className={styles.formSelect} value={filterProject} onChange={e => setFilterProject(e.target.value === 'all' ? 'all' : parseProjectId(e.target.value))} aria-label="Filtrar por projeto">
                          <option value="all">Todos os projetos</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
                      </div>
                      <div className={styles.selectWrap}>
                        <select className={styles.formSelect} value={filterCategory === 'all' ? 'all' : filterCategory === null ? '__none__' : filterCategory} onChange={e => { const v = e.target.value; setFilterCategory(v === 'all' ? 'all' : v === '__none__' ? null : Number(v)) }} aria-label="Filtrar por categoria">
                          <option value="all">Todas as categorias</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          <option value="__none__">Sem categoria</option>
                        </select>
                        <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
                      </div>
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
                    {catTotals.length > 1 && (
                      <div className={styles.breakdown}>
                        <div className={styles.breakdownHead}><span className={styles.breakdownTitle}>Por categoria</span><span className={styles.breakdownSum}>{fmtHoursDec(breakdownTotal)}</span></div>
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
                            <span className={styles.breakdownVal}>{fmtHoursDec(p.dur)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {sortedDays.map(day => (
                      <div className={styles.dayGroup} key={day}>
                        <div className={styles.dayHeader}>
                          <span className={styles.dayName}>{fmtDate(day)}</span>
                          <span className={styles.dayTotal}>{fmtHoursDec(grouped[day].reduce((s, e) => s + e.dur, 0))}</span>
                        </div>
                        {grouped[day].map(entry => (
                          <EntryRow key={entry.id} entry={entry}
                            project={{ name: projName(entry.projectId), color: projColor(entry.projectId) }}
                            category={entry.categoryId != null ? { name: catName(entry.categoryId) } : null}
                            editing={entry.id === editingEntry?.id}
                            onEdit={startEdit} onDelete={deleteEntry} onResume={resumeEntry} onCopy={copyEntryHours} />
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
