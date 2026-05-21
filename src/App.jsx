import { useState, useEffect, useRef, forwardRef } from 'react'
import styles from './App.module.css'

const PROJECTS = ['Geral', 'Design', 'Desenvolvimento', 'Reunião', 'Pesquisa']
const PROJ_COLORS = ['#1D9E75', '#378ADD', '#D4537E', '#BA7517', '#7F77DD']
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDur(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(d) {
  const dt = new Date(d + 'T12:00:00')
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const yd = new Date(now)
  yd.setDate(yd.getDate() - 1)
  const ydStr = yd.toISOString().split('T')[0]
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

function EntryRow({ entry, onEdit, onDelete, onResume, onCopy }) {
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
      className={styles.entryRow}
      style={{ '--entry-accent': PROJ_COLORS[entry.proj] }}
      onClick={() => onEdit(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(entry) } }}
    >
      <span className={styles.entryDesc}>{entry.desc}</span>
      <span className={styles.entryProj}>
        <span className={styles.entryProjDot} aria-hidden="true" />
        {PROJECTS[entry.proj]}
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

const pad2 = n => String(n).padStart(2, '0')

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

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // Entries
  const [entries, setEntries] = useState(() => loadStorage('tt_entries', []))

  useEffect(() => {
    saveStorage('tt_entries', entries)
  }, [entries])

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
      setTimerProj(saved.proj || 0)
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
    if (timerElapsed < 1) return
    const now = new Date()
    const endSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    const startSecs = endSecs - timerElapsed
    const dateStr = now.toISOString().split('T')[0]
    if (timerResumeId !== null) {
      // retomada: estende a entrada original em vez de criar nova
      setEntries(prev => prev.map(x => {
        if (x.id !== timerResumeId) return x
        const end = secsToTime(timeToSecs(x.start) + timerElapsed)
        return { ...x, desc: timerDesc || 'Sem descrição', proj: timerProj, end, dur: timerElapsed }
      }))
    } else {
      const entry = {
        id: Date.now(),
        date: dateStr,
        desc: timerDesc || 'Sem descrição',
        proj: timerProj,
        start: secsToTime(Math.max(0, startSecs)),
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

  // Undo delete
  const [undoState, setUndoState] = useState(null)
  const undoTimerRef = useRef(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Keyboard shortcut (Space → toggle timer)
  const timerToggleRef = useRef(null)
  timerToggleRef.current = () => { if (timerActive) stopTimer(); else startTimer() }
  useEffect(() => {
    const onKey = e => {
      if (e.key !== ' ') return
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (document.activeElement?.contentEditable === 'true') return
      e.preventDefault()
      timerToggleRef.current?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
    setMProj(0)
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

  // Stats
  const today = todayStr()
  const todayTotal = entries.filter(e => e.date === today).reduce((s, e) => s + e.dur, 0)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekTotal = entries.filter(e => e.date >= weekStartStr).reduce((s, e) => s + e.dur, 0)
  const totalAll = entries.reduce((s, e) => s + e.dur, 0)

  // Grouping
  const filteredEntries = searchQuery.trim()
    ? entries.filter(e => e.desc.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : entries
  const grouped = filteredEntries.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

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
                {PROJECTS.map((p, i) => (
                  <option key={i} value={i}>{p}</option>
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
                <label className={styles.formLabel}>Projeto</label>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.formSelect}
                    value={mProj}
                    onChange={e => setMProj(e.target.value)}
                  >
                    {PROJECTS.map((p, i) => (
                      <option key={i} value={i}>{p}</option>
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
              {mErr && (
                <span className={styles.formErr}>
                  <i className="ti ti-alert-circle" aria-hidden="true" />
                  {mErr}
                </span>
              )}
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
              <div className={styles.searchBar}>
                <i className="ti ti-search" aria-hidden="true" />
                <input
                  className={styles.searchInput}
                  placeholder="Buscar..."
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
            {sortedDays.length === 0 ? (
              <div className={styles.noResults}>
                <i className="ti ti-search-off" aria-hidden="true" />
                Nenhum resultado para &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              sortedDays.map(day => (
                <div className={styles.dayGroup} key={day}>
                  <div className={styles.dayHeader}>
                    <span className={styles.dayName}>{fmtDate(day)}</span>
                    <span className={styles.dayTotal}>{fmtHoursDec(grouped[day].reduce((s, e) => s + e.dur, 0))}</span>
                  </div>
                  {grouped[day].map(entry => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onEdit={startEdit}
                      onDelete={deleteEntry}
                      onResume={resumeEntry}
                      onCopy={copyEntryHours}
                    />
                  ))}
                </div>
              ))
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
    </div>
  )
}
