import { useState, useEffect, useRef } from 'react'
import styles from './App.module.css'

const PROJECTS = ['Geral', 'Design', 'Desenvolvimento', 'Reunião', 'Pesquisa']
const PROJ_COLORS = ['#1D9E75', '#378ADD', '#D4537E', '#BA7517', '#7F77DD']

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

function StatCard({ label, value }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  )
}

function EntryRow({ entry, onEdit, onDelete }) {
  return (
    <div
      className={styles.entryRow}
      onClick={() => onEdit(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(entry) } }}
    >
      <span
        className={styles.entryDot}
        style={{ background: PROJ_COLORS[entry.proj] }}
      />
      <span className={styles.entryDesc}>{entry.desc}</span>
      <span className={styles.entryProj}>{PROJECTS[entry.proj]}</span>
      <span className={styles.entryRange}>{entry.start} – {entry.end}</span>
      <span className={styles.entryDur}>{fmtHM(entry.dur)}</span>
      <button
        className={styles.btnDel}
        onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
        aria-label="Remover entrada"
      >
        <i className="ti ti-trash" aria-hidden="true" />
      </button>
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
  const tickRef = useRef(null)

  useEffect(() => {
    const saved = loadStorage('tt_timer', null)
    if (saved?.active) {
      setTimerActive(true)
      setTimerStart(saved.start)
      setTimerDesc(saved.desc || '')
      setTimerProj(saved.proj || 0)
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

  const startTimer = () => {
    const s = Date.now()
    setTimerStart(s)
    setTimerActive(true)
    setTimerElapsed(0)
    saveStorage('tt_timer', { active: true, start: s, desc: timerDesc, proj: timerProj })
  }

  const stopTimer = () => {
    if (timerElapsed < 1) return
    const now = new Date()
    const endSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    const startSecs = endSecs - timerElapsed
    const dateStr = now.toISOString().split('T')[0]
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
    setTimerActive(false)
    setTimerElapsed(0)
    setTimerDesc('')
    saveStorage('tt_timer', { active: false })
  }

  // Manual entry
  const [showManual, setShowManual] = useState(false)
  const [mDate, setMDate] = useState(todayStr())
  const [mStart, setMStart] = useState('09:00')
  const [mEnd, setMEnd] = useState('10:00')
  const [mDesc, setMDesc] = useState('')
  const [mProj, setMProj] = useState(0)
  const [mErr, setMErr] = useState('')
  const [editingId, setEditingId] = useState(null)

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
    setEntries(e => e.filter(x => x.id !== id))
  }

  // Stats
  const today = todayStr()
  const todayTotal = entries.filter(e => e.date === today).reduce((s, e) => s + e.dur, 0)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekTotal = entries.filter(e => e.date >= weekStartStr).reduce((s, e) => s + e.dur, 0)
  const totalAll = entries.reduce((s, e) => s + e.dur, 0)

  // Grouping
  const grouped = entries.reduce((acc, e) => {
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
            <i className="ti ti-clock-play" aria-hidden="true" />
            <span>Time Tracker</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Stats */}
        <div className={styles.statsGrid}>
          <StatCard label="Hoje" value={fmtHM(timerActive ? todayTotal + timerElapsed : todayTotal)} />
          <StatCard label="Esta semana" value={fmtHM(weekTotal)} />
          <StatCard label="Total geral" value={fmtHM(totalAll)} />
        </div>

        {/* Timer */}
        <div className={styles.card}>
          <div className={styles.timerRow}>
            <input
              className={styles.timerInput}
              placeholder="O que você está trabalhando?"
              value={timerDesc}
              onChange={e => setTimerDesc(e.target.value)}
              disabled={timerActive}
            />
            <select
              className={styles.projSelect}
              value={timerProj}
              onChange={e => setTimerProj(parseInt(e.target.value))}
              disabled={timerActive}
            >
              {PROJECTS.map((p, i) => (
                <option key={i} value={i}>{p}</option>
              ))}
            </select>
            <span className={`${styles.timerDisplay} ${timerActive ? styles.timerActive : ''}`}>
              {fmtDur(timerElapsed)}
            </span>
            <button
              className={`${styles.btnPrimary} ${timerActive ? styles.btnStop : ''}`}
              onClick={timerActive ? stopTimer : startTimer}
            >
              {timerActive ? 'Parar' : 'Iniciar'}
            </button>
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
          <div className={styles.card}>
            <div className={styles.sectionLabel} style={{ marginTop: 0 }}>
              {editingId !== null ? 'Editar entrada' : 'Nova entrada'}
            </div>
            <div className={styles.manualGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Data</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={mDate}
                  onChange={e => setMDate(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Projeto</label>
                <select
                  className={styles.formInput}
                  value={mProj}
                  onChange={e => setMProj(e.target.value)}
                >
                  {PROJECTS.map((p, i) => (
                    <option key={i} value={i}>{p}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Início</label>
                <input
                  className={styles.formInput}
                  type="time"
                  value={mStart}
                  onChange={e => setMStart(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Fim</label>
                <input
                  className={styles.formInput}
                  type="time"
                  value={mEnd}
                  onChange={e => setMEnd(e.target.value)}
                />
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
              {mErr && <span className={styles.formErr}>{mErr}</span>}
              <button
                className={styles.btnCancel}
                onClick={() => { resetManual(); setShowManual(false) }}
              >
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={saveManual}>
                {editingId !== null ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        {/* Entries */}
        {sortedDays.length === 0 ? (
          <div className={styles.empty}>
            <i className="ti ti-clock" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} aria-hidden="true" />
            Nenhuma entrada ainda.<br />Inicie o timer ou adicione um horário manual.
          </div>
        ) : (
          <div>
            <div className={styles.sectionLabel}>Entradas</div>
            {sortedDays.map(day => (
              <div className={styles.dayGroup} key={day}>
                <div className={styles.dayHeader}>
                  <span className={styles.dayName}>{fmtDate(day)}</span>
                  <span className={styles.dayTotal}>{fmtHM(grouped[day].reduce((s, e) => s + e.dur, 0))}</span>
                </div>
                {grouped[day].map(entry => (
                  <EntryRow key={entry.id} entry={entry} onEdit={startEdit} onDelete={deleteEntry} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
