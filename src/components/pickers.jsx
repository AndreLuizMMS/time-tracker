import { useState, useEffect, useLayoutEffect, useRef, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import styles from '../App.module.css'
import { pad2, secsToTime, todayStr, WEEKDAYS, MONTHS } from '../lib/format'
import { PALETTE, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS } from '../lib/storage'

// fecha popover ao clicar fora ou apertar Escape (para popovers no fluxo, ex. dentro de .field/.card)
export function useDismiss(open, setOpen, ref) {
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

// popover ancorado e PORTALADO ao body — escapa de containers com overflow (colunas/scroll)
function useAnchoredPopover() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const popRef = useRef(null)
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const alignRight = r.left > window.innerWidth * 0.6
      setPos({ top: Math.round(r.bottom + 6), left: alignRight ? null : Math.round(r.left), right: alignRight ? Math.round(window.innerWidth - r.right) : null })
    }
    place()
    const onDoc = e => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open])
  return { open, setOpen, pos, triggerRef, popRef }
}

function PortalPop({ popRef, pos, className, role, children }) {
  if (!pos) return null
  return createPortal(
    <div ref={popRef} className={className} role={role} style={{ position: 'fixed', top: pos.top, left: pos.left ?? 'auto', right: pos.right ?? 'auto', zIndex: 60 }}>
      {children}
    </div>,
    document.body
  )
}

// ─── Color swatch (paleta fixa) ──────────────────────────────────────────────
export function ColorSwatch({ color, onChange, small }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)
  return (
    <div className={styles.swatchWrap} ref={ref}>
      <button type="button" className={`${styles.swatchBtn} ${small ? styles.swatchBtnSm : ''}`} style={{ '--sw': color }} onClick={() => setOpen(o => !o)} aria-label="Escolher cor" aria-haspopup="dialog" aria-expanded={open} />
      {open && (
        <div className={styles.swatchPop} role="dialog">
          {PALETTE.map(c => (
            <button key={c} type="button" className={`${styles.swatchOpt} ${c.toLowerCase() === color.toLowerCase() ? styles.swatchOptActive : ''}`} style={{ '--sw': c }} onClick={() => { onChange(c); setOpen(false) }} aria-label={c} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Calendar grid (compartilhado por DateField e DeadlineControl) ────────────
function CalPanel({ value, onPick }) {
  const base = value ? new Date(value + 'T12:00:00') : new Date()
  const [view, setView] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))
  const y = view.getFullYear()
  const mo = view.getMonth()
  const firstWeekday = new Date(y, mo, 1).getDay()
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const today = todayStr()
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const dayStr = d => `${y}-${pad2(mo + 1)}-${pad2(d)}`
  return (
    <div className={styles.calPopover} role="dialog">
      <div className={styles.calHeader}>
        <button type="button" className={styles.calNav} onClick={() => setView(new Date(y, mo - 1, 1))} aria-label="Mês anterior"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
        <span className={styles.calTitle}>{MONTHS[mo]} {y}</span>
        <button type="button" className={styles.calNav} onClick={() => setView(new Date(y, mo + 1, 1))} aria-label="Próximo mês"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
      </div>
      <div className={styles.calWeekdays}>{WEEKDAYS.map((w, i) => <span key={i} className={styles.calWeekday}>{w.charAt(0)}</span>)}</div>
      <div className={styles.calGrid}>
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />
          const ds = dayStr(d)
          return (
            <button type="button" key={ds} className={`${styles.calDay} ${ds === value ? styles.calDaySel : ''} ${ds === today && ds !== value ? styles.calDayToday : ''}`} onClick={() => onPick(ds)}>{d}</button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Time field (digitável + roletas) — no fluxo (manual/timer, sem clip) ─────
export const TimeField = forwardRef(function TimeField({ value, onChange, onComplete }, inputRef) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const ref = useRef(null)
  const popRef = useRef(null)
  useDismiss(open, setOpen, ref)
  // só sincroniza o draft com o value externo quando NÃO está focado — durante a edição
  // (timer ativo re-renderiza a cada 1s) o valor digitado não pode ser sobreposto
  useEffect(() => { if (!focused) setDraft(value) }, [value, focused])
  const [h, m] = value.split(':')
  const hours = Array.from({ length: 24 }, (_, i) => pad2(i))
  const mins = Array.from({ length: 60 }, (_, i) => pad2(i))
  useEffect(() => {
    if (!open || !popRef.current) return
    popRef.current.querySelectorAll(`.${styles.timeOptActive}`).forEach(el => el.scrollIntoView({ block: 'center' }))
  }, [open])
  const handleType = e => {
    const el = e.target
    const d = el.value.replace(/\D/g, '').slice(0, 4)
    const formatted = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
    setDraft(formatted)
    // o ":" auto-inserido empurra o cursor pra antes do dígito de minuto → próximo dígito entra na frente
    // (03:1 + 0 = 03:01). força o cursor pro fim após o render p/ digitação sequencial correta.
    requestAnimationFrame(() => { try { el.setSelectionRange(formatted.length, formatted.length) } catch {} })
    if (d.length === 4) {
      const hh = Math.min(23, parseInt(d.slice(0, 2), 10))
      const mm = Math.min(59, parseInt(d.slice(2, 4), 10))
      onChange(`${pad2(hh)}:${pad2(mm)}`)
      onComplete?.()
    }
  }
  const handleBlur = () => {
    setFocused(false)
    const d = draft.replace(/\D/g, '')
    if (!d) { setDraft(value); return }
    // entrada parcial preserva a parte não digitada do valor atual (digitar só a hora não zera os minutos)
    const [, vm] = value.split(':')
    const hh = Math.min(23, parseInt(d.slice(0, 2), 10))
    const mm = d.length > 2 ? Math.min(59, parseInt(d.slice(2, 4), 10)) : parseInt(vm, 10)
    const v = `${pad2(hh)}:${pad2(mm)}`
    onChange(v); setDraft(v)
  }
  return (
    <div className={styles.field} ref={ref}>
      <div className={`${styles.fieldTrigger} ${open ? styles.fieldTriggerOpen : ''}`}>
        <i className="ti ti-clock-hour-4" aria-hidden="true" />
        <input ref={inputRef} className={styles.timeTextInput} value={draft} onChange={handleType} onBlur={handleBlur} onFocus={e => { setFocused(true); e.target.select() }} inputMode="numeric" placeholder="--:--" maxLength={5} aria-label="Hora (HH:MM)" />
        <button type="button" className={styles.fieldChevronBtn} onClick={() => setOpen(o => !o)} aria-label="Escolher hora" aria-haspopup="dialog" aria-expanded={open}><i className={`ti ti-chevron-down ${styles.fieldChevron}`} aria-hidden="true" /></button>
      </div>
      {open && (
        <div className={styles.timePopover} role="dialog" ref={popRef}>
          <div className={styles.timeCol}>
            <div className={styles.timeColLabel}>Hora</div>
            <div className={styles.timeColScroll}>{hours.map(hh => <button type="button" key={hh} className={`${styles.timeOpt} ${hh === h ? styles.timeOptActive : ''}`} onClick={() => onChange(`${hh}:${m}`)}>{hh}</button>)}</div>
          </div>
          <div className={styles.timeDivider} aria-hidden="true" />
          <div className={styles.timeCol}>
            <div className={styles.timeColLabel}>Min</div>
            <div className={styles.timeColScroll}>{mins.map(mm => <button type="button" key={mm} className={`${styles.timeOpt} ${mm === m ? styles.timeOptActive : ''}`} onClick={() => onChange(`${h}:${mm}`)}>{mm}</button>)}</div>
          </div>
        </div>
      )}
    </div>
  )
})

// ─── Date field (no fluxo — manual/filtros) ──────────────────────────────────
export function DateField({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)
  const label = new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className={styles.field} ref={ref}>
      <button type="button" className={`${styles.fieldTrigger} ${open ? styles.fieldTriggerOpen : ''}`} onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <i className="ti ti-calendar-event" aria-hidden="true" />
        <span className={styles.fieldValue}>{label}</span>
        <i className={`ti ti-chevron-down ${styles.fieldChevron}`} aria-hidden="true" />
      </button>
      {open && <CalPanel value={value} onPick={ds => { onChange(ds); setOpen(false) }} />}
    </div>
  )
}

// ─── Priority picker (seleção direta, portalado, sem teleporte) ──────────────
export function PriorityPicker({ value, onChange, onOpenChange }) {
  const { open, setOpen, pos, triggerRef, popRef } = useAnchoredPopover()
  const setO = next => { setOpen(next); onOpenChange?.(next) }
  return (
    <div className={styles.prioWrap}>
      <button ref={triggerRef} type="button" className={`${styles.prioTrigger} ${styles[`prioLvl${value}`]}`} style={{ '--prio': PRIORITY_COLORS[value] }} onClick={() => setO(!open)} aria-haspopup="menu" aria-expanded={open} title={`Prioridade: ${PRIORITY_LABELS[value - 1]}`}>P{value}</button>
      {open && (
        <PortalPop popRef={popRef} pos={pos} className={styles.prioPop} role="menu">
          {[1, 2, 3, 4].map(p => (
            <button key={p} type="button" role="menuitemradio" aria-checked={p === value} className={`${styles.prioOpt} ${p === value ? styles.prioOptActive : ''}`} style={{ '--prio': PRIORITY_COLORS[p] }} onClick={() => { onChange(p); setO(false) }}>
              <span className={styles.prioDot} aria-hidden="true" />
              <span className={styles.prioOptTag}>P{p}</span>
              {PRIORITY_LABELS[p - 1]}
            </button>
          ))}
        </PortalPop>
      )}
    </div>
  )
}

// ─── Chip picker (projeto / categoria) — portalado ──────────────────────────
export function ChipPicker({ value, options, onChange, allowNone, noneLabel = 'Sem categoria', icon, title, large }) {
  const { open, setOpen, pos, triggerRef, popRef } = useAnchoredPopover()
  const current = options.find(o => o.id === value) || null
  return (
    <div className={`${styles.chipWrap} ${large ? styles.chipWrapLg : ''}`}>
      <button ref={triggerRef} type="button" className={`${styles.chipPick} ${large ? styles.chipPickLg : ''} ${!current ? styles.chipPickNone : ''}`} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} title={title}>
        {current ? <span className={styles.chipDot} style={{ background: current.color }} aria-hidden="true" /> : <i className={`ti ${icon || 'ti-tag'} ${styles.chipIcon}`} aria-hidden="true" />}
        <span className={styles.chipLabel}>{current?.name ?? noneLabel}</span>
        <i className={`ti ti-chevron-down ${styles.chipChevron}`} aria-hidden="true" />
      </button>
      {open && (
        <PortalPop popRef={popRef} pos={pos} className={styles.chipPop} role="menu">
          {allowNone && (
            <button type="button" role="menuitemradio" aria-checked={value == null} className={`${styles.chipOpt} ${value == null ? styles.chipOptActive : ''}`} onClick={() => { onChange(null); setOpen(false) }}>
              <i className={`ti ${icon || 'ti-tag-off'} ${styles.chipOptIcon}`} aria-hidden="true" />{noneLabel}
            </button>
          )}
          {options.map(o => (
            <button key={o.id} type="button" role="menuitemradio" aria-checked={o.id === value} className={`${styles.chipOpt} ${o.id === value ? styles.chipOptActive : ''}`} onClick={() => { onChange(o.id); setOpen(false) }}>
              <span className={styles.chipDot} style={{ background: o.color }} aria-hidden="true" />{o.name}
            </button>
          ))}
        </PortalPop>
      )}
    </div>
  )
}

// ─── Time-log control — lança duração numa tarefa (e conclui) — portalado ────
export function TimeLogControl({ onLog, disabled }) {
  const { open, setOpen, pos, triggerRef, popRef } = useAnchoredPopover()
  const [draft, setDraft] = useState('00:30')
  const inputRef = useRef(null)
  useEffect(() => {
    if (!open) return
    setDraft('00:30')
    requestAnimationFrame(() => inputRef.current?.select())
  }, [open])
  const d = draft.replace(/\D/g, '')
  const secs = d ? (parseInt(d.slice(0, 2) || '0', 10) * 3600 + Math.min(59, parseInt(d.slice(2, 4) || '0', 10)) * 60) : 0
  const handleType = e => {
    const el = e.target
    const digits = el.value.replace(/\D/g, '').slice(0, 4)
    const f = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
    setDraft(f)
    requestAnimationFrame(() => { try { el.setSelectionRange(f.length, f.length) } catch {} })
  }
  const fire = conclude => { if (secs > 0) { onLog(secs, conclude); setOpen(false) } }
  const chips = [['15min', 900], ['30min', 1800], ['1h', 3600], ['2h', 7200], ['4h', 14400]]
  return (
    <div className={styles.chipWrap}>
      <button ref={triggerRef} type="button" className={styles.iconAction} onClick={() => setOpen(o => !o)} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label="Lançar tempo" title="Lançar tempo">
        <i className="ti ti-clock-plus" aria-hidden="true" />
      </button>
      {open && (
        <PortalPop popRef={popRef} pos={pos} className={styles.timeLogPop} role="dialog">
          <div className={styles.timeLogLabel}>Lançar tempo</div>
          <input ref={inputRef} className={styles.timeLogInput} value={draft} onChange={handleType} onFocus={e => e.target.select()} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fire(true) } }} inputMode="numeric" placeholder="HH:MM" maxLength={5} aria-label="Duração (HH:MM)" />
          <div className={styles.timeLogChips}>
            {chips.map(([lbl, s]) => (
              <button key={lbl} type="button" className={styles.timeLogChip} onClick={() => setDraft(secsToTime(s))}>{lbl}</button>
            ))}
          </div>
          <div className={styles.timeLogActions}>
            <button type="button" className={styles.timeLogGhost} onClick={() => fire(false)} disabled={secs <= 0}>Só lançar</button>
            <button type="button" className={styles.timeLogPrimary} onClick={() => fire(true)} disabled={secs <= 0}>
              <i className="ti ti-check" aria-hidden="true" />Lançar e concluir
            </button>
          </div>
        </PortalPop>
      )}
    </div>
  )
}

// ─── Status control — pílula + transições válidas (portalado) ────────────────
export function StatusControl({ status, onToAberta, onToAguardando, onToConcluida, onReopen }) {
  const { open, setOpen, pos, triggerRef, popRef } = useAnchoredPopover()
  const pick = fn => { setOpen(false); fn() }
  return (
    <div className={styles.statusWrap}>
      <button ref={triggerRef} type="button" className={`${styles.statusPill} ${styles[`statusPill_${status}`]}`} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} title="Mudar estado">
        <span className={styles.statusDot} aria-hidden="true" />{STATUS_LABELS[status]}<i className={`ti ti-chevron-down ${styles.statusChevron}`} aria-hidden="true" />
      </button>
      {open && (
        <PortalPop popRef={popRef} pos={pos} className={styles.statusPop} role="menu">
          {status === 'aberta' && (<>
            <button type="button" role="menuitem" className={styles.statusOpt} onClick={() => pick(onToAguardando)}><i className="ti ti-hourglass-high" aria-hidden="true" /> Marcar aguardando</button>
            <button type="button" role="menuitem" className={styles.statusOpt} onClick={() => pick(onToConcluida)}><i className="ti ti-check" aria-hidden="true" /> Concluir</button>
          </>)}
          {status === 'aguardando' && (<>
            <button type="button" role="menuitem" className={styles.statusOpt} onClick={() => pick(onToAberta)}><i className="ti ti-arrow-back-up" aria-hidden="true" /> Trazer de volta</button>
            <button type="button" role="menuitem" className={styles.statusOpt} onClick={() => pick(onToConcluida)}><i className="ti ti-check" aria-hidden="true" /> Concluir</button>
          </>)}
          {status === 'concluida' && (
            <button type="button" role="menuitem" className={styles.statusOpt} onClick={() => pick(onReopen)}><i className="ti ti-rotate" aria-hidden="true" /> Reabrir</button>
          )}
        </PortalPop>
      )}
    </div>
  )
}

// ─── Waiting control — pessoa (opcional) + dias úteis parados ─────────────────
export function WaitingControl({ person, businessDays, stuck, onChangePerson }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(person || '')
  useEffect(() => { setDraft(person || '') }, [person])
  const commit = () => { setEditing(false); onChangePerson(draft.trim() || null) }
  return (
    <span className={styles.waitWrap}>
      <i className="ti ti-user-pause" aria-hidden="true" />
      {editing ? (
        <input className={styles.waitInput} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') { setDraft(person || ''); setEditing(false) } }} placeholder="quem?" autoFocus aria-label="Pessoa do aguardando" />
      ) : (
        <button type="button" className={styles.waitPerson} onClick={() => setEditing(true)} title="Editar pessoa">{person || 'aguardando'}</button>
      )}
      <span className={`${styles.waitBadge} ${stuck ? styles.waitBadgeStuck : ''}`} title="Dias úteis parado">há {businessDays}d úteis</span>
    </span>
  )
}

// ─── Deadline control — prazo opcional (portalado) ───────────────────────────
export function DeadlineControl({ deadline, state, onChange }) {
  const { open, setOpen, pos, triggerRef, popRef } = useAnchoredPopover()
  const label = deadline ? new Date(deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'prazo'
  return (
    <div className={styles.deadlineWrap}>
      <button ref={triggerRef} type="button" className={`${styles.deadlineBtn} ${deadline ? styles[`deadline_${state}`] : styles.deadlineEmpty}`} onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open} title={deadline ? `Prazo ${label}` : 'Definir prazo'}>
        <i className="ti ti-flag" aria-hidden="true" /><span className={styles.deadlineLabel}>{label}</span>
      </button>
      {open && (
        <PortalPop popRef={popRef} pos={pos} className={styles.deadlinePop}>
          <CalPanel value={deadline} onPick={ds => { onChange(ds); setOpen(false) }} />
          {deadline && (
            <button type="button" className={styles.deadlineClear} onClick={() => { onChange(null); setOpen(false) }}><i className="ti ti-x" aria-hidden="true" /> Remover prazo</button>
          )}
        </PortalPop>
      )}
    </div>
  )
}
