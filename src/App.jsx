import { useState, useEffect, useRef, forwardRef } from 'react'
import styles from './App.module.css'

const DEFAULT_PROJECTS = [
  { id: 0, name: 'Geral', color: '#1D9E75' },
  { id: 1, name: 'Design', color: '#378ADD' },
  { id: 2, name: 'Desenvolvimento', color: '#D4537E' },
  { id: 3, name: 'Reunião', color: '#BA7517' },
  { id: 4, name: 'Pesquisa', color: '#7F77DD' },
]
const PALETTE = ['#1D9E75', '#2FB488', '#378ADD', '#7F77DD', '#D4537E', '#E24B4A', '#E0A03B', '#BA7517', '#54534E']
const FALLBACK_COLOR = '#74726b'

const PRIORITY_COLORS = { 1: '#E24B4A', 2: '#E0A03B', 3: '#1D9E75', 4: '#74726B' }
const PRIORITY_LABELS = ['Urgente', 'Alta', 'Normal', 'Baixa']
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// ─── Helpers ────────────────────────────────────────────────────────────────

const pad2 = n => String(n).padStart(2, '0')

function fmtDur(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

function fmtHM(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function fmtHoursDec(secs) {
  const h = Math.round((secs / 3600) * 100) / 100
  return `${h}h`
}

function timeToSecs(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 3600 + m * 60
}

function secsToTime(s) {
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}`
}

// data local (evita deslocamento de fuso do toISOString em UTC)
function localDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function todayStr() {
  return localDateStr(new Date())
}

function fmtDate(d) {
  const dt = new Date(d + 'T12:00:00')
  const now = new Date()
  const today = localDateStr(now)
  const yd = new Date(now)
  yd.setDate(yd.getDate() - 1)
  const ydStr = localDateStr(yd)
  if (d === today) return 'Hoje'
  if (d === ydStr) return 'Ontem'
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

// dispara download de um arquivo gerado em memória
function downloadFile(filename, text, type) {
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

function csvCell(v) {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ─── Components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, primary }) {
  return (
    <div className={`${styles.statCard} ${primary ? styles.statCardPrimary : ''}`}>
      <div className={styles.statLabel}>
        <i className={`ti ${icon}`} aria-hidden="true" />
        {label}
      </div>
      <div className={styles.statValue}>{value}</div>
    </div>
  )
}

function EntryRow({ entry, project, editing, onEdit, onDelete, onResume, onCopy }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async e => {
    e.stopPropagation()
    const ok = await onCopy(entry)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    }
  }

  return (
    <div
      className={`${styles.entryRow} ${editing ? styles.entryRowEditing : ''}`}
      style={{ '--entry-accent': project.color }}
      onClick={() => onEdit(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(entry) } }}
    >
      <span className={styles.entryDesc}>{entry.desc}</span>
      <span className={styles.entryProj}>
        <span className={styles.entryProjDot} aria-hidden="true" />
        {project.name}
      </span>
      <span className={styles.entryRange}>{entry.start} – {entry.end}</span>
      <span className={styles.entryDur}>{fmtHoursDec(entry.dur)}</span>
      <div className={styles.entryActions}>
        <button
          className={styles.btnAction}
          onClick={e => { e.stopPropagation(); onResume(entry) }}
          aria-label="Retomar timer desta entrada"
          title="Retomar timer"
        >
          <i className="ti ti-player-play-filled" aria-hidden="true" />
        </button>
        <button
          className={`${styles.btnAction} ${copied ? styles.btnActionOk : ''}`}
          onClick={handleCopy}
          aria-label="Copiar horas desta entrada"
          title={copied ? 'Copiado' : 'Copiar horas'}
        >
          <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
        </button>
        <button
          className={styles.btnDel}
          onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
          aria-label="Remover entrada"
        >
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ─── Field pickers (presentational — value string in, value string out) ───────

function useDismiss(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen, ref])
}

// seletor de cor por paleta fixa
function ColorSwatch({ color, onChange, small }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)
  return (
    <div className={styles.swatchWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.swatchBtn} ${small ? styles.swatchBtnSm : ''}`}
        style={{ '--sw': color }}
        onClick={() => setOpen(o => !o)}
        aria-label="Escolher cor"
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      {open && (
        <div className={styles.swatchPop} role="dialog">
          {PALETTE.map(c => (
            <button
              key={c}
              type="button"
              className={`${styles.swatchOpt} ${c.toLowerCase() === color.toLowerCase() ? styles.swatchOptActive : ''}`}
              style={{ '--sw': c }}
              onClick={() => { onChange(c); setOpen(false) }}
              aria-label={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const TimeField = forwardRef(function TimeField({ value, onChange, onComplete }, inputRef) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)
  const popRef = useRef(null)
  useDismiss(open, setOpen, ref)

  // mantém o que se digita em sincronia com o valor normalizado externo
  useEffect(() => { setDraft(value) }, [value])

  const [h, m] = value.split(':')
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  // centra o valor atual ao abrir
  useEffect(() => {
    if (!open || !popRef.current) return
    popRef.current.querySelectorAll(`.${styles.timeOptActive}`).forEach(el =>
      el.scrollIntoView({ block: 'center' })
    )
  }, [open])

  // digitação com máscara: "0930" → "09:30", propaga só quando completo/válido
  const handleType = e => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4)
    setDraft(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d)
    if (d.length === 4) {
      const hh = Math.min(23, parseInt(d.slice(0, 2), 10))
      const mm = Math.min(59, parseInt(d.slice(2, 4), 10))
      onChange(`${pad2(hh)}:${pad2(mm)}`)
      onComplete?.()
    }
  }

  const handleBlur = () => {
    const d = draft.replace(/\D/g, '')
    if (!d) { setDraft(value); return }
    const hh = Math.min(23, parseInt(d.slice(0, 2) || '0', 10))
    const mm = Math.min(59, parseInt(d.slice(2, 4) || '0', 10))
    const v = `${pad2(hh)}:${pad2(mm)}`
    onChange(v)
    setDraft(v)
  }

  return (
    <div className={styles.field} ref={ref}>
      <div className={`${styles.fieldTrigger} ${open ? styles.fieldTriggerOpen : ''}`}>
        <i className="ti ti-clock-hour-4" aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.timeTextInput}
          value={draft}
          onChange={handleType}
          onBlur={handleBlur}
          onFocus={e => e.target.select()}
          inputMode="numeric"
          placeholder="--:--"
          maxLength={5}
          aria-label="Hora (HH:MM)"
        />
        <button
          type="button"
          className={styles.fieldChevronBtn}
          onClick={() => setOpen(o => !o)}
          aria-label="Escolher hora"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <i className={`ti ti-chevron-down ${styles.fieldChevron}`} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className={styles.timePopover} role="dialog" ref={popRef}>
          <div className={styles.timeCol}>
            <div className={styles.timeColLabel}>Hora</div>
            <div className={styles.timeColScroll}>
              {hours.map(hh => (
                <button
                  type="button"
                  key={hh}
                  className={`${styles.timeOpt} ${hh === h ? styles.timeOptActive : ''}`}
                  onClick={() => onChange(`${hh}:${m}`)}
                >
                  {hh}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.timeDivider} aria-hidden="true" />
          <div className={styles.timeCol}>
            <div className={styles.timeColLabel}>Min</div>
            <div className={styles.timeColScroll}>
              {mins.map(mm => (
                <button
                  type="button"
                  key={mm}
                  className={`${styles.timeOpt} ${mm === m ? styles.timeOptActive : ''}`}
                  onClick={() => onChange(`${h}:${mm}`)}
                >
                  {mm}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

function DateField({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)

  const selected = new Date(value + 'T12:00:00')
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))

  useEffect(() => {
    if (open) setView(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const y = view.getFullYear()
  const mo = view.getMonth()
  const firstWeekday = new Date(y, mo, 1).getDay()
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const today = todayStr()

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dayStr = d => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const label = selected.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className={styles.field} ref={ref}>
      <button
        type="button"
        className={`${styles.fieldTrigger} ${open ? styles.fieldTriggerOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <i className="ti ti-calendar-event" aria-hidden="true" />
        <span className={styles.fieldValue}>{label}</span>
        <i className={`ti ti-chevron-down ${styles.fieldChevron}`} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.calPopover} role="dialog">
          <div className={styles.calHeader}>
            <button
              type="button"
              className={styles.calNav}
              onClick={() => setView(new Date(y, mo - 1, 1))}
              aria-label="Mês anterior"
            >
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
            <span className={styles.calTitle}>{MONTHS[mo]} {y}</span>
            <button
              type="button"
              className={styles.calNav}
              onClick={() => setView(new Date(y, mo + 1, 1))}
              aria-label="Próximo mês"
            >
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
          </div>
          <div className={styles.calWeekdays}>
            {WEEKDAYS.map((w, i) => (
              <span key={i} className={styles.calWeekday}>{w.charAt(0)}</span>
            ))}
          </div>
          <div className={styles.calGrid}>
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />
              const ds = dayStr(d)
              const isSel = ds === value
              const isToday = ds === today
              return (
                <button
                  type="button"
                  key={ds}
                  className={`${styles.calDay} ${isSel ? styles.calDaySel : ''} ${isToday && !isSel ? styles.calDayToday : ''}`}
                  onClick={() => { onChange(ds); setOpen(false) }}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// menu de dados (exportar / importar) no header
function DataMenu({ onExportCsv, onExportJson, onImport }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const fileRef = useRef(null)
  useDismiss(open, setOpen, ref)

  const pick = fn => { setOpen(false); fn() }

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => setOpen(o => !o)}
        aria-label="Dados e backup"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Dados e backup"
      >
        <i className="ti ti-dots-vertical" aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button className={styles.menuItem} role="menuitem" onClick={() => pick(onExportCsv)}>
            <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            Exportar CSV
          </button>
          <button className={styles.menuItem} role="menuitem" onClick={() => pick(onExportJson)}>
            <i className="ti ti-download" aria-hidden="true" />
            Exportar backup (JSON)
          </button>
          <button className={styles.menuItem} role="menuitem" onClick={() => pick(() => fileRef.current?.click())}>
            <i className="ti ti-upload" aria-hidden="true" />
            Importar backup
          </button>
        </div>
      )}
      {/* input fora do {open && ...}: fechar o menu não pode desmontar o input
          antes do onChange disparar, senão a importação some silenciosamente */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className={styles.hiddenFile}
        onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }}
      />
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // Projects
  const [projects, setProjects] = useState(() => {
    const saved = loadStorage('tt_projects', null)
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_PROJECTS
  })
  useEffect(() => { saveStorage('tt_projects', projects) }, [projects])

  const projById = id => projects.find(p => p.id === id)
  const projName = id => projById(id)?.name ?? 'Sem categoria'
  const projColor = id => projById(id)?.color ?? FALLBACK_COLOR

  // Entries
  const [entries, setEntries] = useState(() => loadStorage('tt_entries', []))
  useEffect(() => { saveStorage('tt_entries', entries) }, [entries])

  // Transient notice toast
  const [notice, setNotice] = useState(null)
  const noticeRef = useRef(null)
  const showNotice = msg => {
    clearTimeout(noticeRef.current)
    setNotice(msg)
    noticeRef.current = setTimeout(() => setNotice(null), 2600)
  }

  // Timer
  const [timerActive, setTimerActive] = useState(false)
  const [timerStart, setTimerStart] = useState(null)
  const [timerElapsed, setTimerElapsed] = useState(0)
  const [timerDesc, setTimerDesc] = useState('')
  const [timerProj, setTimerProj] = useState(0)
  const [timerResumeId, setTimerResumeId] = useState(null)
  const tickRef = useRef(null)

  const persistTimer = patch => {
    saveStorage('tt_timer', {
      active: true,
      start: timerStart,
      desc: timerDesc,
      proj: timerProj,
      resumeId: timerResumeId,
      ...patch,
    })
  }

  useEffect(() => {
    const saved = loadStorage('tt_timer', null)
    if (saved?.active) {
      setTimerActive(true)
      setTimerStart(saved.start)
      setTimerDesc(saved.desc || '')
      setTimerProj(saved.proj ?? 0)
      setTimerResumeId(saved.resumeId ?? null)
    }
  }, [])

  useEffect(() => {
    if (timerActive && timerStart) {
      tickRef.current = setInterval(() => {
        setTimerElapsed(Math.floor((Date.now() - timerStart) / 1000))
      }, 1000)
    } else {
      clearInterval(tickRef.current)
    }
    return () => clearInterval(tickRef.current)
  }, [timerActive, timerStart])

  useEffect(() => {
    document.title = timerActive ? `${fmtDur(timerElapsed)} • Time Tracker` : 'Time Tracker'
    return () => { document.title = 'Time Tracker' }
  }, [timerActive, timerElapsed])

  const startTimer = () => {
    const s = Date.now()
    setTimerStart(s)
    setTimerActive(true)
    setTimerElapsed(0)
    saveStorage('tt_timer', { active: true, start: s, desc: timerDesc, proj: timerProj, resumeId: null })
  }

  const stopTimer = () => {
    if (timerElapsed < 1) {
      setTimerActive(false)
      setTimerElapsed(0)
      setTimerResumeId(null)
      saveStorage('tt_timer', { active: false })
      showNotice('Timer muito curto — descartado')
      return
    }
    // deriva início/fim/data do instante real de início (suporta virar meia-noite)
    const startDate = new Date(timerStart)
    const dateStr = localDateStr(startDate)
    const startSecs = startDate.getHours() * 3600 + startDate.getMinutes() * 60 + startDate.getSeconds()
    const endSecs = (startSecs + timerElapsed) % 86400
    if (timerResumeId !== null) {
      // retomada: estende a entrada original em vez de criar nova
      setEntries(prev => prev.map(x => {
        if (x.id !== timerResumeId) return x
        const end = secsToTime((timeToSecs(x.start) + timerElapsed) % 86400)
        return { ...x, desc: timerDesc || 'Sem descrição', proj: timerProj, end, dur: timerElapsed }
      }))
    } else {
      const entry = {
        id: Date.now(),
        date: dateStr,
        desc: timerDesc || 'Sem descrição',
        proj: timerProj,
        start: secsToTime(startSecs),
        end: secsToTime(endSecs),
        dur: timerElapsed,
      }
      setEntries(e => [entry, ...e])
    }
    setTimerActive(false)
    setTimerElapsed(0)
    setTimerDesc('')
    setTimerResumeId(null)
    saveStorage('tt_timer', { active: false })
  }

  // retoma o timer a partir de uma entrada salva, continuando da duração registrada
  const resumeEntry = entry => {
    if (timerActive) return
    const s = Date.now() - entry.dur * 1000
    setTimerDesc(entry.desc === 'Sem descrição' ? '' : entry.desc)
    setTimerProj(entry.proj)
    setTimerResumeId(entry.id)
    setTimerStart(s)
    setTimerElapsed(entry.dur)
    setTimerActive(true)
    saveStorage('tt_timer', { active: true, start: s, desc: entry.desc, proj: entry.proj, resumeId: entry.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ajusta manualmente a hora de início de um timer ativo
  const setTimerStartTime = hhmm => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(timerStart ?? Date.now())
    d.setHours(h, m, 0, 0)
    let s = d.getTime()
    if (s > Date.now()) s -= 86400000 // início no futuro → assume dia anterior
    setTimerStart(s)
    setTimerElapsed(Math.floor((Date.now() - s) / 1000))
    persistTimer({ start: s })
  }

  const copyEntryHours = async entry => {
    try {
      await navigator.clipboard.writeText(fmtHoursDec(entry.dur).replace('h', ''))
      return true
    } catch {
      return false
    }
  }

  // ─── Categorias (CRUD) ──────────────────────────────────────────────────────
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [newProjColor, setNewProjColor] = useState(PALETTE[0])

  const addProject = () => {
    const name = newProjName.trim()
    if (!name) return
    setProjects(prev => [...prev, { id: Date.now(), name, color: newProjColor }])
    setNewProjName('')
    setNewProjColor(PALETTE[(projects.length + 1) % PALETTE.length])
  }
  const renameProject = (id, name) => setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
  const recolorProject = (id, color) => setProjects(prev => prev.map(p => p.id === id ? { ...p, color } : p))
  const deleteProject = id => {
    if (projects.length <= 1) { showNotice('Mantenha ao menos uma categoria'); return }
    const used = entries.some(e => e.proj === id)
    if (used && !window.confirm('Há entradas nesta categoria. Removê-la deixa essas entradas sem categoria. Continuar?')) return
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  // ─── Backup (export / import) ─────────────────────────────────────────────
  const exportCsv = () => {
    if (entries.length === 0) { showNotice('Nada para exportar'); return }
    const header = ['Data', 'Início', 'Fim', 'Duração (h)', 'Categoria', 'Descrição']
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    const lines = [header, ...sorted.map(e => [
      e.date, e.start, e.end, (e.dur / 3600).toFixed(2).replace('.', ','), projName(e.proj), e.desc,
    ])]
    const csv = '﻿' + lines.map(r => r.map(csvCell).join(';')).join('\r\n')
    downloadFile(`time-tracker-${todayStr()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const exportJson = () => {
    const data = { version: 1, exportedAt: new Date().toISOString(), projects, entries, tasks }
    downloadFile(`time-tracker-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json')
  }

  const importJson = file => {
    const reader = new FileReader()
    reader.onload = () => {
      let data
      try {
        data = JSON.parse(reader.result)
      } catch {
        showNotice('Arquivo inválido')
        return
      }
      if (!data || (!Array.isArray(data.entries) && !Array.isArray(data.tasks) && !Array.isArray(data.projects))) {
        showNotice('Backup não reconhecido')
        return
      }
      if (!window.confirm('Importar substitui todos os dados atuais (entradas, tarefas e categorias). Continuar?')) return
      if (Array.isArray(data.projects) && data.projects.length) setProjects(data.projects)
      if (Array.isArray(data.entries)) setEntries(data.entries)
      if (Array.isArray(data.tasks)) setTasks(data.tasks)
      showNotice('Backup importado')
    }
    reader.readAsText(file)
  }

  // Tasks backlog
  const [tasks, setTasks] = useState(() => loadStorage('tt_tasks', []))
  const [taskInput, setTaskInput] = useState('')
  const [taskPriority, setTaskPriority] = useState(3)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [showDoneTasks, setShowDoneTasks] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTaskText, setEditingTaskText] = useState('')
  const taskInputRef = useRef(null)

  useEffect(() => { saveStorage('tt_tasks', tasks) }, [tasks])

  const addTask = () => {
    const title = taskInput.trim()
    if (!title) return
    setTasks(prev => [...prev, { id: Date.now(), title, priority: taskPriority, done: false, createdAt: Date.now() }])
    setTaskInput('')
    taskInputRef.current?.focus()
  }
  const deleteTask = id => setTasks(prev => prev.filter(t => t.id !== id))
  const toggleDone = id => setTasks(prev => prev.map(t => {
    if (t.id !== id) return t
    const done = !t.done
    return { ...t, done, completedAt: done ? Date.now() : null }
  }))
  const cyclePriority = id => setTasks(prev =>
    prev.map(t => t.id === id ? { ...t, priority: t.priority === 4 ? 1 : t.priority + 1 } : t)
  )

  const beginEditTask = task => { setEditingTaskId(task.id); setEditingTaskText(task.title) }
  const commitEditTask = () => {
    const title = editingTaskText.trim()
    if (title) setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, title } : t))
    setEditingTaskId(null)
    setEditingTaskText('')
  }

  const startTimerFromTask = task => {
    if (timerActive) return
    const s = Date.now()
    setTimerDesc(task.title)
    setTimerProj(projects[0]?.id ?? 0)
    setTimerStart(s)
    setTimerActive(true)
    setTimerElapsed(0)
    setTimerResumeId(null)
    saveStorage('tt_timer', { active: true, start: s, desc: task.title, proj: projects[0]?.id ?? 0, resumeId: null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Undo delete
  const [undoState, setUndoState] = useState(null)
  const undoTimerRef = useRef(null)

  // Search + filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterProj, setFilterProj] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const searchRef = useRef(null)

  const clearFilters = () => { setFilterProj('all'); setFilterFrom(''); setFilterTo('') }
  const hasFilters = filterProj !== 'all' || filterFrom || filterTo

  // intervalos de tempo fixos (atalhos)
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  const presets = (() => {
    const now = new Date()
    const t = localDateStr(now)
    const ws = addDays(now, -now.getDay()) // domingo da semana atual
    return [
      { key: 'hoje', label: 'Hoje', from: t, to: t },
      { key: 'ontem', label: 'Ontem', from: localDateStr(addDays(now, -1)), to: localDateStr(addDays(now, -1)) },
      { key: 'semana', label: 'Esta semana', from: localDateStr(ws), to: t },
      { key: 'semana-ant', label: 'Semana passada', from: localDateStr(addDays(ws, -7)), to: localDateStr(addDays(ws, -1)) },
      { key: '7d', label: 'Últimos 7 dias', from: localDateStr(addDays(now, -6)), to: t },
      { key: '15d', label: 'Últimos 15 dias', from: localDateStr(addDays(now, -14)), to: t },
      { key: '30d', label: 'Últimos 30 dias', from: localDateStr(addDays(now, -29)), to: t },
      { key: 'mes', label: 'Este mês', from: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: t },
    ]
  })()
  const activePreset = presets.find(p => p.from === filterFrom && p.to === filterTo)?.key
  const applyPreset = p => { setFilterFrom(p.from); setFilterTo(p.to) }

  // Manual entry
  const [showManual, setShowManual] = useState(false)
  const [mDate, setMDate] = useState(todayStr())
  const [mStart, setMStart] = useState('09:00')
  const [mEnd, setMEnd] = useState('10:00')
  const [mDesc, setMDesc] = useState('')
  const [mProj, setMProj] = useState(0)
  const [mErr, setMErr] = useState('')
  const [editingId, setEditingId] = useState(null)
  const endRef = useRef(null)

  const resetManual = () => {
    setMDesc('')
    setMStart('09:00')
    setMEnd('10:00')
    setMProj(projects[0]?.id ?? 0)
    setMDate(todayStr())
    setEditingId(null)
    setMErr('')
  }

  const startEdit = entry => {
    setEditingId(entry.id)
    setMDate(entry.date)
    setMProj(entry.proj)
    setMStart(entry.start)
    setMEnd(entry.end)
    setMDesc(entry.desc === 'Sem descrição' ? '' : entry.desc)
    setMErr('')
    setShowManual(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveManual = () => {
    setMErr('')
    const s = timeToSecs(mStart)
    const e = timeToSecs(mEnd)
    if (e <= s) { setMErr('Horário de fim deve ser após o início'); return }
    const data = {
      date: mDate,
      desc: mDesc || 'Sem descrição',
      proj: parseInt(mProj),
      start: mStart,
      end: mEnd,
      dur: e - s,
    }
    setEntries(prev => {
      const next = editingId !== null
        ? prev.map(x => (x.id === editingId ? { ...x, ...data } : x))
        : [{ id: Date.now(), ...data }, ...prev]
      next.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
      return next
    })
    resetManual()
    setShowManual(false)
  }

  // duração derivada para o campo manual; editá-la ajusta o fim
  const mDurSecs = Math.max(0, timeToSecs(mEnd) - timeToSecs(mStart))
  const setDurationField = hhmm => {
    let endS = timeToSecs(mStart) + timeToSecs(hhmm)
    if (endS > 86340) endS = 86340
    setMEnd(secsToTime(endS))
  }

  // aviso de sobreposição (não bloqueia o salvamento)
  const mSsec = timeToSecs(mStart)
  const mEsec = timeToSecs(mEnd)
  const overlap = showManual && mEsec > mSsec && entries.some(x =>
    x.id !== editingId && x.date === mDate &&
    mSsec < timeToSecs(x.end) && mEsec > timeToSecs(x.start)
  )

  const deleteEntry = id => {
    if (id === editingId) { resetManual(); setShowManual(false) }
    const idx = entries.findIndex(x => x.id === id)
    const entry = entries[idx]
    clearTimeout(undoTimerRef.current)
    setUndoState({ entry, index: idx })
    undoTimerRef.current = setTimeout(() => setUndoState(null), 4500)
    setEntries(e => e.filter(x => x.id !== id))
  }

  const handleUndo = () => {
    clearTimeout(undoTimerRef.current)
    if (!undoState) return
    setEntries(prev => {
      const next = [...prev, undoState.entry]
      next.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
      return next
    })
    setUndoState(null)
  }

  const timerStartStr = timerStart
    ? secsToTime(new Date(timerStart).getHours() * 3600 + new Date(timerStart).getMinutes() * 60)
    : '00:00'

  // Keyboard shortcuts: Space → timer · M → manual · / → busca
  const actionsRef = useRef({})
  actionsRef.current = {
    toggleTimer: () => { if (timerActive) stopTimer(); else startTimer() },
    toggleManual: () => {
      if (showManual) { resetManual(); setShowManual(false) }
      else { setShowManual(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    },
    focusSearch: () => searchRef.current?.focus(),
  }
  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.contentEditable === 'true'
      if (typing) return
      if (e.key === ' ') { e.preventDefault(); actionsRef.current.toggleTimer() }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); actionsRef.current.toggleManual() }
      else if (e.key === '/') { e.preventDefault(); actionsRef.current.focusSearch() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Stats
  const today = todayStr()
  const todayTotal = entries.filter(e => e.date === today).reduce((s, e) => s + e.dur, 0)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekStartStr = localDateStr(weekStart)
  const weekTotal = entries.filter(e => e.date >= weekStartStr).reduce((s, e) => s + e.dur, 0)
  const totalAll = entries.reduce((s, e) => s + e.dur, 0)

  // Filtering + grouping
  const q = searchQuery.toLowerCase().trim()
  const filteredEntries = entries.filter(e => {
    if (q && !e.desc.toLowerCase().includes(q)) return false
    if (filterProj !== 'all' && e.proj !== filterProj) return false
    if (filterFrom && e.date < filterFrom) return false
    if (filterTo && e.date > filterTo) return false
    return true
  })
  const grouped = filteredEntries.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e)
    return acc
  }, {})
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Breakdown por categoria (respeita filtros)
  const projTotals = (() => {
    const map = new Map()
    filteredEntries.forEach(e => map.set(e.proj, (map.get(e.proj) || 0) + e.dur))
    const arr = [...map.entries()].map(([id, dur]) => ({ id, dur, name: projName(id), color: projColor(id) }))
    arr.sort((a, b) => b.dur - a.dur)
    return arr
  })()
  const breakdownMax = projTotals[0]?.dur || 1
  const breakdownTotal = projTotals.reduce((s, p) => s + p.dur, 0)

  const activeTasks = tasks
    .filter(t => !t.done)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)
  const doneTasks = tasks
    .filter(t => t.done)
    .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))

  // concluídas agrupadas por dia de conclusão (mais recentes no topo)
  const doneByDay = doneTasks.reduce((acc, t) => {
    const key = t.completedAt ? localDateStr(new Date(t.completedAt)) : todayStr()
    ;(acc[key] = acc[key] || []).push(t)
    return acc
  }, {})
  const doneDays = Object.keys(doneByDay).sort((a, b) => b.localeCompare(a))
  const fmtTime = ts => {
    const d = new Date(ts)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>
              <i className="ti ti-clock-play" aria-hidden="true" />
            </span>
            <span>Time Tracker</span>
          </div>
          <DataMenu onExportCsv={exportCsv} onExportJson={exportJson} onImport={importJson} />
        </div>
      </header>

      <main className={styles.main}>
        {/* Stats */}
        <div className={styles.sectionLabel} style={{ marginTop: 0 }}>Resumo</div>
        <div className={styles.statsGrid}>
          <StatCard label="Hoje" icon="ti-calendar-event" primary value={fmtHoursDec(timerActive ? todayTotal + timerElapsed : todayTotal)} />
          <StatCard label="Semana" icon="ti-calendar-week" value={fmtHoursDec(weekTotal)} />
          <StatCard label="Total" icon="ti-sum" value={fmtHoursDec(totalAll)} />
        </div>

        {/* Timer hero */}
        <div className={`${styles.timerCard} ${timerActive ? styles.timerCardActive : ''}`}>
          <div className={styles.timerInputs}>
            <input
              className={styles.timerInput}
              placeholder="O que você está trabalhando?"
              value={timerDesc}
              onChange={e => {
                setTimerDesc(e.target.value)
                if (timerActive) persistTimer({ desc: e.target.value })
              }}
            />
            <div className={styles.selectWrap}>
              <select
                className={styles.projSelect}
                value={timerProj}
                onChange={e => {
                  const v = parseInt(e.target.value)
                  setTimerProj(v)
                  if (timerActive) persistTimer({ proj: v })
                }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
            </div>
          </div>
          {timerActive && (
            <div className={styles.timerStartEdit}>
              <span className={styles.timerStartLabel}>
                <i className="ti ti-clock-edit" aria-hidden="true" />
                Início
              </span>
              <TimeField value={timerStartStr} onChange={setTimerStartTime} />
            </div>
          )}
          <div className={styles.timerHero}>
            <div className={styles.timerReadout}>
              {timerActive && <span className={styles.pulseDot} aria-hidden="true" />}
              <span className={`${styles.timerDisplay} ${timerActive ? styles.timerActive : ''}`}>
                {fmtDur(timerElapsed)}
              </span>
            </div>
            <div className={styles.timerBtnWrap}>
              <button
                className={`${styles.btnPrimary} ${styles.btnTimer} ${timerActive ? styles.btnStop : ''}`}
                onClick={timerActive ? stopTimer : startTimer}
                title={timerActive ? 'Parar (Space)' : 'Iniciar (Space)'}
              >
                <i className={`ti ${timerActive ? 'ti-player-stop-filled' : 'ti-player-play-filled'}`} aria-hidden="true" />
                {timerActive ? 'Parar' : 'Iniciar'}
              </button>
              <span className={styles.kbdHint}><kbd>Space</kbd></span>
            </div>
          </div>
        </div>

        {/* Manual entry toggle */}
        <button
          className={`${styles.manualToggle} ${showManual ? styles.manualToggleOpen : ''}`}
          onClick={() => {
            if (showManual) { resetManual(); setShowManual(false) }
            else setShowManual(true)
          }}
        >
          <i className="ti ti-clock-plus" aria-hidden="true" />
          Adicionar horário manual
          <i className={`ti ti-chevron-down ${styles.chevron}`} aria-hidden="true" />
        </button>

        {/* Manual entry form */}
        {showManual && (
          <form className={styles.card} onSubmit={e => { e.preventDefault(); saveManual() }}>
            <div className={styles.sectionLabel} style={{ marginTop: 0 }}>
              {editingId !== null ? 'Editar entrada' : 'Nova entrada'}
            </div>
            <div className={styles.manualGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Data</label>
                <DateField value={mDate} onChange={setMDate} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Categoria</label>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.formSelect}
                    value={mProj}
                    onChange={e => setMProj(parseInt(e.target.value))}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Início</label>
                <TimeField value={mStart} onChange={setMStart} onComplete={() => endRef.current?.focus()} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Fim</label>
                <TimeField ref={endRef} value={mEnd} onChange={setMEnd} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duração</label>
                <TimeField value={secsToTime(mDurSecs)} onChange={setDurationField} />
              </div>
            </div>
            <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
              <label className={styles.formLabel}>Descrição</label>
              <input
                className={styles.formInput}
                placeholder="O que você trabalhou?"
                value={mDesc}
                onChange={e => setMDesc(e.target.value)}
              />
            </div>
            <div className={styles.manualFooter}>
              {mErr ? (
                <span className={styles.formErr}>
                  <i className="ti ti-alert-circle" aria-hidden="true" />
                  {mErr}
                </span>
              ) : overlap ? (
                <span className={styles.formWarn}>
                  <i className="ti ti-alert-triangle" aria-hidden="true" />
                  Sobrepõe outra entrada neste dia
                </span>
              ) : null}
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { resetManual(); setShowManual(false) }}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary}>
                {editingId !== null ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        )}

        {/* Projects manager */}
        <div className={styles.taskSection}>
          <button
            className={`${styles.taskSectionHeader} ${projectsOpen ? styles.taskSectionOpen : ''}`}
            onClick={() => setProjectsOpen(o => !o)}
            aria-expanded={projectsOpen}
          >
            <span className={styles.taskSectionTitle}>
              <i className="ti ti-folders" aria-hidden="true" />
              Categorias
            </span>
            <span className={styles.taskCountBadge}>{projects.length}</span>
            <i className={`ti ti-chevron-down ${styles.chevron}`} aria-hidden="true" />
          </button>
          {projectsOpen && (
            <div className={styles.taskBody}>
              <div className={styles.projList}>
                {projects.map(p => (
                  <div key={p.id} className={styles.projRow}>
                    <ColorSwatch color={p.color} onChange={c => recolorProject(p.id, c)} small />
                    <input
                      className={styles.projNameInput}
                      value={p.name}
                      onChange={e => renameProject(p.id, e.target.value)}
                      aria-label="Nome da categoria"
                    />
                    <button
                      className={styles.btnDel}
                      onClick={() => deleteProject(p.id)}
                      aria-label="Remover categoria"
                      disabled={projects.length <= 1}
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.projAddRow}>
                <ColorSwatch color={newProjColor} onChange={setNewProjColor} small />
                <input
                  className={styles.taskAddInput}
                  placeholder="Nova categoria..."
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProject() } }}
                  aria-label="Nova categoria"
                />
                <button
                  type="button"
                  className={styles.taskAddBtn}
                  onClick={addProject}
                  disabled={!newProjName.trim()}
                  aria-label="Adicionar categoria"
                >
                  <i className="ti ti-plus" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Task Backlog */}
        <div className={styles.taskSection}>
          <button
            className={`${styles.taskSectionHeader} ${tasksOpen ? styles.taskSectionOpen : ''}`}
            onClick={() => setTasksOpen(o => !o)}
            aria-expanded={tasksOpen}
          >
            <span className={styles.taskSectionTitle}>
              <i className="ti ti-list-check" aria-hidden="true" />
              Tarefas
            </span>
            {activeTasks.length > 0 && (
              <span className={styles.taskCountBadge}>{activeTasks.length}</span>
            )}
            <i className={`ti ti-chevron-down ${styles.chevron}`} aria-hidden="true" />
          </button>

          {tasksOpen && (
            <div className={styles.taskBody}>
              <div className={styles.taskAddRow}>
                <div className={styles.taskPriorityPicker}>
                  {[1, 2, 3, 4].map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.taskPriorityBtn} ${taskPriority === p ? styles.taskPriorityBtnActive : ''} ${styles[`priorityBtn${p}`]}`}
                      onClick={() => setTaskPriority(p)}
                      aria-label={`Prioridade P${p}`}
                      title={PRIORITY_LABELS[p - 1]}
                    >
                      P{p}
                    </button>
                  ))}
                </div>
                <input
                  ref={taskInputRef}
                  className={styles.taskAddInput}
                  placeholder="Adicionar tarefa..."
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask() } }}
                  aria-label="Nova tarefa"
                />
                <button
                  type="button"
                  className={styles.taskAddBtn}
                  onClick={addTask}
                  disabled={!taskInput.trim()}
                  aria-label="Adicionar tarefa"
                >
                  <i className="ti ti-plus" aria-hidden="true" />
                </button>
              </div>

              {tasks.length === 0 && (
                <p className={styles.taskEmpty}>Nenhuma tarefa. Adicione acima.</p>
              )}

              <div className={styles.taskList}>
                {activeTasks.map(task => (
                  <div
                    key={task.id}
                    className={styles.taskRow}
                    style={{ '--task-priority-color': PRIORITY_COLORS[task.priority] }}
                  >
                    <button
                      className={`${styles.taskBadge} ${styles[`priorityBadge${task.priority}`]}`}
                      onClick={() => cyclePriority(task.id)}
                      aria-label={`Prioridade P${task.priority} — clique para mudar`}
                      title="Clique para mudar prioridade"
                    >
                      P{task.priority}
                    </button>
                    {editingTaskId === task.id ? (
                      <input
                        className={styles.taskEditInput}
                        value={editingTaskText}
                        onChange={e => setEditingTaskText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitEditTask() }
                          if (e.key === 'Escape') { setEditingTaskId(null); setEditingTaskText('') }
                        }}
                        onBlur={commitEditTask}
                        autoFocus
                        aria-label="Editar tarefa"
                      />
                    ) : (
                      <span
                        className={styles.taskTitle}
                        onDoubleClick={() => beginEditTask(task)}
                        title="Duplo clique para editar"
                      >
                        {task.title}
                      </span>
                    )}
                    <div className={styles.taskActions}>
                      <button
                        className={`${styles.btnAction} ${styles.taskStartBtn}`}
                        onClick={() => startTimerFromTask(task)}
                        disabled={timerActive}
                        aria-label="Iniciar timer com esta tarefa"
                        title={timerActive ? 'Timer em andamento' : 'Iniciar timer'}
                      >
                        <i className="ti ti-player-play-filled" aria-hidden="true" />
                        <span className={styles.taskStartLabel}>Iniciar</span>
                      </button>
                      <button
                        className={styles.btnAction}
                        onClick={() => beginEditTask(task)}
                        aria-label="Editar tarefa"
                        title="Editar"
                      >
                        <i className="ti ti-pencil" aria-hidden="true" />
                      </button>
                      <button
                        className={styles.btnAction}
                        onClick={() => toggleDone(task.id)}
                        aria-label="Marcar como concluída"
                        title="Concluir"
                      >
                        <i className="ti ti-check" aria-hidden="true" />
                      </button>
                      <button
                        className={styles.btnDel}
                        onClick={() => deleteTask(task.id)}
                        aria-label="Remover tarefa"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {doneTasks.length > 0 && (
                <div className={styles.doneSection}>
                  <button
                    className={`${styles.doneHeader} ${showDoneTasks ? styles.doneHeaderOpen : ''}`}
                    onClick={() => setShowDoneTasks(o => !o)}
                    aria-expanded={showDoneTasks}
                  >
                    <span className={styles.doneHeaderTitle}>
                      <i className="ti ti-circle-check-filled" aria-hidden="true" />
                      Concluídas
                    </span>
                    <span className={styles.doneHeaderCount}>{doneTasks.length}</span>
                    <i className={`ti ti-chevron-down ${styles.chevron}`} aria-hidden="true" />
                  </button>

                  {showDoneTasks && (
                    <div className={styles.doneBody}>
                      {doneDays.map(day => (
                        <div key={day} className={styles.doneGroup}>
                          <div className={styles.doneDayHeader}>
                            <span className={styles.doneDayName}>{fmtDate(day)}</span>
                            <span className={styles.doneDayCount}>
                              {doneByDay[day].length} tarefa{doneByDay[day].length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className={styles.taskList}>
                            {doneByDay[day].map(task => (
                              <div
                                key={task.id}
                                className={`${styles.taskRow} ${styles.doneRow}`}
                                style={{ '--task-priority-color': PRIORITY_COLORS[task.priority] }}
                              >
                                <span className={styles.doneCheck} aria-hidden="true">
                                  <i className="ti ti-check" />
                                </span>
                                <span className={`${styles.taskTitle} ${styles.doneTitle}`}>{task.title}</span>
                                {task.completedAt && (
                                  <span className={styles.doneTime}>{fmtTime(task.completedAt)}</span>
                                )}
                                <div className={styles.taskActions}>
                                  <button
                                    className={styles.btnAction}
                                    onClick={() => toggleDone(task.id)}
                                    aria-label="Reabrir tarefa"
                                    title="Reabrir"
                                  >
                                    <i className="ti ti-rotate-ccw" aria-hidden="true" />
                                  </button>
                                  <button
                                    className={styles.btnDel}
                                    onClick={() => deleteTask(task.id)}
                                    aria-label="Remover tarefa"
                                  >
                                    <i className="ti ti-trash" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Entries */}
        {entries.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <i className="ti ti-clock-hour-3" aria-hidden="true" />
            </span>
            <div className={styles.emptyTitle}>Nenhuma entrada ainda</div>
            <p className={styles.emptyText}>
              Inicie o timer acima ou adicione um horário manual para começar a registrar seu tempo.
            </p>
          </div>
        ) : (
          <div>
            <div className={styles.entriesHeader}>
              <span className={styles.sectionLabel} style={{ marginBottom: 0 }}>Entradas</span>
              <div className={styles.entriesTools}>
                <button
                  className={`${styles.filterToggle} ${filtersOpen || hasFilters ? styles.filterToggleOn : ''}`}
                  onClick={() => setFiltersOpen(o => !o)}
                  aria-label="Filtros"
                  aria-expanded={filtersOpen}
                  title="Filtros"
                >
                  <i className="ti ti-filter" aria-hidden="true" />
                  {hasFilters && <span className={styles.filterDot} aria-hidden="true" />}
                </button>
                <div className={styles.searchBar}>
                  <i className="ti ti-search" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    className={styles.searchInput}
                    placeholder="Buscar... ( / )"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label="Buscar entradas"
                  />
                  {searchQuery && (
                    <button className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Limpar busca">
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filtersOpen && (
              <div className={styles.filterPanel}>
                <div className={styles.filterPresets}>
                  {presets.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      className={`${styles.presetChip} ${activePreset === p.key ? styles.presetChipActive : ''}`}
                      onClick={() => applyPreset(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className={styles.filterRow}>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.formSelect}
                    value={filterProj}
                    onChange={e => setFilterProj(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    aria-label="Filtrar por categoria"
                  >
                    <option value="all">Todas as categorias</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
                </div>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={filterFrom}
                  max={filterTo || undefined}
                  onChange={e => setFilterFrom(e.target.value)}
                  aria-label="Data inicial"
                />
                <span className={styles.filterSep}>até</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={filterTo}
                  min={filterFrom || undefined}
                  onChange={e => setFilterTo(e.target.value)}
                  aria-label="Data final"
                />
                {hasFilters && (
                  <button className={styles.filterClear} onClick={clearFilters}>
                    <i className="ti ti-x" aria-hidden="true" />
                    Limpar
                  </button>
                )}
                </div>
              </div>
            )}

            {sortedDays.length === 0 ? (
              <div className={styles.noResults}>
                <i className="ti ti-search-off" aria-hidden="true" />
                Nenhum resultado{q ? ` para “${searchQuery}”` : ''}
              </div>
            ) : (
              <>
                {projTotals.length > 1 && (
                  <div className={styles.breakdown}>
                    <div className={styles.breakdownHead}>
                      <span className={styles.breakdownTitle}>Por categoria</span>
                      <span className={styles.breakdownSum}>{fmtHoursDec(breakdownTotal)}</span>
                    </div>
                    {projTotals.map(p => (
                      <div key={p.id} className={styles.breakdownRow}>
                        <span className={styles.breakdownName}>
                          <span className={styles.breakdownDot} style={{ background: p.color }} aria-hidden="true" />
                          {p.name}
                        </span>
                        <div className={styles.breakdownTrack}>
                          <div
                            className={styles.breakdownBar}
                            style={{ width: `${(p.dur / breakdownMax) * 100}%`, background: p.color }}
                          />
                        </div>
                        <span className={styles.breakdownVal}>{fmtHoursDec(p.dur)}</span>
                      </div>
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
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        project={{ name: projName(entry.proj), color: projColor(entry.proj) }}
                        editing={entry.id === editingId}
                        onEdit={startEdit}
                        onDelete={deleteEntry}
                        onResume={resumeEntry}
                        onCopy={copyEntryHours}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {undoState && (
        <div className={styles.undoToast} role="status">
          <span className={styles.undoMsg}>
            <i className="ti ti-trash" aria-hidden="true" />
            Entrada removida
          </span>
          <button className={styles.undoBtn} onClick={handleUndo}>Desfazer</button>
        </div>
      )}

      {notice && (
        <div className={styles.noticeToast} role="status">
          <i className="ti ti-info-circle" aria-hidden="true" />
          {notice}
        </div>
      )}
    </div>
  )
}
