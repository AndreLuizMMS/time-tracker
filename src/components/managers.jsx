import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from '../App.module.css'
import { fmtClock, timeToSecs, secsToTime, todayStr } from '../lib/format'
import { GERAL_ID, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS, ENTRY_KINDS, ENTRY_KIND_DEFAULT, ENTRY_KIND_LABELS, entryKindColor } from '../lib/storage'
import { ColorSwatch, ChipPicker, TimeField, DateField, useDismiss } from './pickers'

// ─── Entry row (entrada de tempo) ─────────────────────────────────────────────
export function EntryRow({ entry, project, category, editing, onEdit, onDelete, onCopy, onToggleSimpli }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async e => {
    e.stopPropagation()
    const ok = await onCopy(entry)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1400) }
  }
  return (
    <div
      className={`${styles.entryRow} ${editing ? styles.entryRowEditing : ''} ${entry.simpli ? styles.entryRowSimpli : ''}`}
      style={{ '--entry-accent': project.color }}
      onClick={() => onEdit(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(entry) } }}
    >
      <div className={styles.entryTop}>
        <span className={styles.entryDesc}>{entry.desc}</span>
        <div className={styles.entryActions}>
          <button
            className={`${styles.iconAction} ${entry.simpli ? styles.iconActionSimpli : ''}`}
            onClick={e => { e.stopPropagation(); onToggleSimpli(entry.id) }}
            aria-label={entry.simpli ? 'Marcado como adicionado ao Simpli' : 'Marcar como adicionado ao Simpli'}
            aria-pressed={!!entry.simpli}
            title={entry.simpli ? 'Adicionado ao Simpli — clique p/ desmarcar' : 'Marcar como adicionado ao Simpli'}
          >
            <i className={`ti ${entry.simpli ? 'ti-checkbox' : 'ti-square'}`} aria-hidden="true" />
          </button>
          <button className={`${styles.iconAction} ${copied ? styles.iconActionOk : ''}`} onClick={handleCopy} aria-label="Copiar horas desta entrada" title={copied ? 'Copiado' : 'Copiar horas'}>
            <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
          </button>
          <button className={`${styles.iconAction} ${styles.iconActionDanger}`} onClick={e => { e.stopPropagation(); onDelete(entry.id) }} aria-label="Remover entrada">
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={styles.entryMeta}>
        <span className={styles.entryProj}>
          <span className={styles.entryProjDot} aria-hidden="true" />
          {project.name}
        </span>
        {category && <span className={styles.entryCat}>{category.name}</span>}
        <span className={styles.entryKind} style={{ '--kind-c': entryKindColor(entry.kind) }}>
          <span className={styles.entryKindDot} aria-hidden="true" />{ENTRY_KIND_LABELS[entry.kind] ?? ENTRY_KIND_LABELS[ENTRY_KIND_DEFAULT]}
        </span>
        <span className={styles.entryRange}>{entry.start} – {entry.end}</span>
        {entry.simpli && (
          <span className={styles.entrySimpliTag}><i className="ti ti-circle-check" aria-hidden="true" />no Simpli</span>
        )}
        <span className={styles.entryDur}>{fmtClock(entry.dur)}</span>
      </div>
    </div>
  )
}

// ─── Entry group (mesmo nome, mesmo dia) ──────────────────────────────────────
// Um trabalho partido em blocos (manhã + tarde) aparece como UMA linha com a
// soma das horas. Os blocos continuam separados — expandir mostra cada um.
// Grupo de um bloco só cai direto no EntryRow: sem cabeçalho, sem ruído.
export function EntryGroup({ group, project, catName, editingId, onEdit, onDelete, onCopy, onCopyTotal, onToggleSimpli, onToggleSimpliAll }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const rowFor = entry => (
    <EntryRow key={entry.id} entry={entry}
      project={project}
      category={entry.categoryId != null ? { name: catName(entry.categoryId) } : null}
      editing={entry.id === editingId}
      onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} onToggleSimpli={onToggleSimpli} />
  )

  if (group.count === 1) return rowFor(group.lead)

  const ids = group.items.map(e => e.id)
  const handleCopyTotal = async e => {
    e.stopPropagation()
    const ok = await onCopyTotal(group.total)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1400) }
  }

  return (
    <div className={`${styles.entryGroup} ${group.allSimpli ? styles.entryGroupSimpli : ''}`} style={{ '--entry-accent': project.color }}>
      <button type="button" className={styles.entryGroupHead} onClick={() => setOpen(o => !o)} aria-expanded={open}
        title={open ? 'Recolher blocos' : `Ver os ${group.count} blocos`}>
        <i className={`ti ti-chevron-down ${styles.entryGroupChevron} ${open ? '' : styles.entryGroupChevronClosed}`} aria-hidden="true" />
        <span className={styles.entryGroupDesc}>{group.lead.desc}</span>
        <span className={styles.entryGroupCount} title="Blocos de tempo neste dia">{group.count}×</span>
        <span className={styles.entryGroupTotal}>{fmtClock(group.total)}</span>
      </button>

      <div className={styles.entryGroupMeta}>
        <span className={styles.entryProj}><span className={styles.entryProjDot} aria-hidden="true" />{project.name}</span>
        {group.lead.categoryId != null && <span className={styles.entryCat}>{catName(group.lead.categoryId)}</span>}
        <span className={styles.entryKind} style={{ '--kind-c': entryKindColor(group.lead.kind) }}>
          <span className={styles.entryKindDot} aria-hidden="true" />{ENTRY_KIND_LABELS[group.lead.kind] ?? ENTRY_KIND_LABELS[ENTRY_KIND_DEFAULT]}
        </span>
        <span className={styles.entryRange}>{group.firstStart} – {group.lastEnd}</span>
        {group.allSimpli && <span className={styles.entrySimpliTag}><i className="ti ti-circle-check" aria-hidden="true" />no Simpli</span>}
        <div className={styles.entryGroupActions}>
          <button
            className={`${styles.iconAction} ${group.allSimpli ? styles.iconActionSimpli : ''}`}
            onClick={() => onToggleSimpliAll(ids, !group.allSimpli)}
            aria-pressed={group.allSimpli}
            aria-label={group.allSimpli ? 'Desmarcar grupo no Simpli' : 'Marcar grupo como adicionado ao Simpli'}
            title={group.allSimpli ? 'Todos no Simpli — clique p/ desmarcar' : group.anySimpli ? 'Parcialmente no Simpli — clique p/ marcar todos' : 'Marcar todos como adicionados ao Simpli'}
          >
            <i className={`ti ${group.allSimpli ? 'ti-checkbox' : group.anySimpli ? 'ti-square-minus' : 'ti-square'}`} aria-hidden="true" />
          </button>
          <button className={`${styles.iconAction} ${copied ? styles.iconActionOk : ''}`} onClick={handleCopyTotal}
            aria-label="Copiar total do grupo" title={copied ? 'Copiado' : 'Copiar total somado'}>
            <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && <div className={styles.entryGroupBody}>{group.items.map(rowFor)}</div>}
    </div>
  )
}

// ─── Data menu (export / import) ──────────────────────────────────────────────
export function DataMenu({ onExportCsv, onExportJson, onImport }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const fileRef = useRef(null)
  useDismiss(open, setOpen, ref)
  const pick = fn => { setOpen(false); fn() }
  return (
    <div className={styles.menuWrap} ref={ref}>
      <button type="button" className={styles.iconBtn} onClick={() => setOpen(o => !o)} aria-label="Dados e backup" aria-haspopup="menu" aria-expanded={open} title="Dados e backup">
        <i className="ti ti-dots-vertical" aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button className={styles.menuItem} role="menuitem" onClick={() => pick(onExportCsv)}>
            <i className="ti ti-file-spreadsheet" aria-hidden="true" /> Exportar CSV
          </button>
          <button className={styles.menuItem} role="menuitem" onClick={() => pick(onExportJson)}>
            <i className="ti ti-download" aria-hidden="true" /> Exportar backup (JSON)
          </button>
          <button className={styles.menuItem} role="menuitem" onClick={() => pick(() => fileRef.current?.click())}>
            <i className="ti ti-upload" aria-hidden="true" /> Importar backup
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="application/json,.json" className={styles.hiddenFile} onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
    </div>
  )
}

// ─── Manual entry form (auto-contido; remonta por `key` ao trocar de edição) ──
export function ManualEntryForm({ editing, projects, categories, defaultProjectId, defaultCategoryId, entries, onSave, onCancel }) {
  const init = editing || {}
  const [date, setDate] = useState(init.date ?? todayStr())
  const [start, setStart] = useState(init.start ?? '09:00')
  const [end, setEnd] = useState(init.end ?? '10:00')
  const [desc, setDesc] = useState(init.desc && init.desc !== 'Sem descrição' ? init.desc : '')
  const [projectId, setProjectId] = useState(init.projectId ?? defaultProjectId ?? GERAL_ID)
  const [categoryId, setCategoryId] = useState(init.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? null)
  const [kind, setKind] = useState(init.kind ?? ENTRY_KIND_DEFAULT)
  const [err, setErr] = useState('')
  const endRef = useRef(null)

  const sSec = timeToSecs(start)
  const eSec = timeToSecs(end)
  const durSecs = Math.max(0, eSec - sSec)
  const setDurationField = hhmm => {
    let endS = timeToSecs(start) + timeToSecs(hhmm)
    if (endS > 86340) endS = 86340
    setEnd(secsToTime(endS))
  }
  const overlap = eSec > sSec && entries.some(x =>
    x.id !== editing?.id && x.date === date && sSec < timeToSecs(x.end) && eSec > timeToSecs(x.start)
  )

  const submit = e => {
    e.preventDefault()
    if (eSec <= sSec) { setErr('Horário de fim deve ser após o início'); return }
    onSave({
      id: editing?.id,
      date, desc: desc || 'Sem descrição',
      projectId, categoryId, kind,
      start, end, dur: eSec - sSec,
    })
  }

  const accent = projects.find(p => p.id === projectId)?.color

  return createPortal(
    <div className={styles.helpOverlay} role="dialog" aria-modal="true" aria-label={editing ? 'Editar entrada' : 'Nova entrada'} onClick={onCancel}>
    <form className={styles.helpModal} style={{ maxWidth: 480, '--accent-color': accent }} onClick={e => e.stopPropagation()} onSubmit={submit}>
      <div className={styles.helpHead}>
        <span className={styles.helpTitle}><i className="ti ti-clock-plus" aria-hidden="true" />{editing ? 'Editar entrada' : 'Nova entrada'}</span>
        <button type="button" className={styles.iconBtn} onClick={onCancel} aria-label="Fechar"><i className="ti ti-x" aria-hidden="true" /></button>
      </div>
      <div className={styles.manualGrid}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Data</label>
          <DateField value={date} onChange={setDate} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Classificação</label>
          <ChipPicker value={kind} options={ENTRY_KINDS} onChange={setKind} icon="ti-tag" title="Classificação" large block />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Projeto</label>
          <ChipPicker value={projectId} options={projects} onChange={setProjectId} icon="ti-folder" title="Projeto" large block />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Categoria</label>
          <ChipPicker value={categoryId} options={categories} onChange={setCategoryId} allowNone noneLabel="Sem categoria" icon="ti-tag" title="Categoria" large block />
        </div>
      </div>
      <div className={styles.manualGridTime}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Início</label>
          <TimeField value={start} onChange={setStart} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Fim</label>
          <TimeField ref={endRef} value={end} onChange={setEnd} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Duração</label>
          <TimeField value={secsToTime(durSecs)} onChange={setDurationField} />
        </div>
      </div>
      <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
        <label className={styles.formLabel}>Descrição</label>
        <input className={styles.formInput} placeholder="O que você trabalhou?" value={desc} onChange={e => setDesc(e.target.value)} />
      </div>
      {(err || overlap) && (
        <div className={styles.manualFeedback}>
          {err ? (
            <span className={styles.formErr}><i className="ti ti-alert-circle" aria-hidden="true" />{err}</span>
          ) : (
            <span className={styles.formWarn}><i className="ti ti-alert-triangle" aria-hidden="true" />Sobrepõe outra entrada neste dia</span>
          )}
        </div>
      )}
      <div className={styles.manualFooter}>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={styles.btnPrimary}>{editing ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>
    </div>,
    document.body
  )
}

// ─── Dialog de edição rápida (cola da daily) — Nome + data de conclusão ───────
export function ColaEditDialog({ item, onSave, onCancel }) {
  const [title, setTitle] = useState(item.title)
  const [date, setDate] = useState(item.date ?? todayStr())
  const submit = e => {
    e.preventDefault()
    if (item.kind === 'task' && !title.trim()) return
    onSave({ title, date: item.hasDate ? date : null })
  }
  return createPortal(
    <div className={styles.helpOverlay} role="dialog" aria-modal="true" aria-label="Editar item" onClick={onCancel}>
      <form className={styles.helpModal} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className={styles.helpHead}>
          <span className={styles.helpTitle}><i className="ti ti-pencil" aria-hidden="true" />Editar {item.kind === 'entry' ? 'entrada' : 'tarefa'}</span>
          <button type="button" className={styles.iconBtn} onClick={onCancel} aria-label="Fechar"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
          <label className={styles.formLabel}>Nome</label>
          <input className={styles.formInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome" autoFocus />
        </div>
        {item.hasDate && (
          <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
            <label className={styles.formLabel}>Data de conclusão</label>
            <DateField value={date} onChange={setDate} />
          </div>
        )}
        <div className={styles.manualFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>Salvar</button>
        </div>
      </form>
    </div>,
    document.body
  )
}

// ─── Dialog de edição completa de tarefa (aba de projeto) ─────────────────────
const PRIORITY_OPTIONS = [1, 2, 3, 4].map(p => ({ id: p, name: `P${p} · ${PRIORITY_LABELS[p - 1]}`, color: PRIORITY_COLORS[p] }))
const STATUS_OPTIONS = ['aberta', 'aguardando', 'concluida'].map(s => ({ id: s, name: STATUS_LABELS[s] }))

export function TaskEditDialog({ task, categories, projects, today, onSave, onCancel }) {
  const [title, setTitle] = useState(task.title)
  const [projectId, setProjectId] = useState(task.projectId)
  const [categoryId, setCategoryId] = useState(task.categoryId ?? null)
  const [priority, setPriority] = useState(task.priority)
  const [status, setStatus] = useState(task.status)
  const [deadline, setDeadline] = useState(task.deadline ?? null)
  const [blocking, setBlocking] = useState(!!task.blocking)
  const [focus, setFocus] = useState(task.todayDate === today)
  const [waitingPerson, setWaitingPerson] = useState(task.waitingPerson ?? '')
  const submit = e => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title, projectId, categoryId, priority, status, deadline, blocking, focus, waitingPerson: waitingPerson.trim() || null })
  }
  return createPortal(
    <div className={styles.helpOverlay} role="dialog" aria-modal="true" aria-label="Editar tarefa" onClick={onCancel}>
      <form className={styles.helpModal} onClick={e => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 460 }}>
        <div className={styles.helpHead}>
          <span className={styles.helpTitle}><i className="ti ti-pencil" aria-hidden="true" />Editar tarefa</span>
          <button type="button" className={styles.iconBtn} onClick={onCancel} aria-label="Fechar"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
          <label className={styles.formLabel}>Nome</label>
          <input className={styles.formInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da tarefa" autoFocus />
        </div>
        <div className={styles.manualGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Projeto</label>
            <ChipPicker value={projectId} options={projects} onChange={setProjectId} icon="ti-folder" title="Projeto" large block />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Categoria</label>
            <ChipPicker value={categoryId} options={categories} onChange={setCategoryId} allowNone noneLabel="Sem categoria" icon="ti-tag" title="Categoria" large block />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Prioridade</label>
            <ChipPicker value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} icon="ti-flag" title="Prioridade" large block />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <ChipPicker value={status} options={STATUS_OPTIONS} onChange={setStatus} icon="ti-progress-check" title="Status" large block />
          </div>
        </div>
        {status === 'aguardando' && (
          <div className={styles.formGroup} style={{ marginTop: '12px' }}>
            <label className={styles.formLabel}>Aguardando quem?</label>
            <input className={styles.formInput} value={waitingPerson} onChange={e => setWaitingPerson(e.target.value)} placeholder="Pessoa (opcional)" />
          </div>
        )}
        <div className={styles.formGroup} style={{ marginTop: '12px' }}>
          <label className={styles.formLabel}>Prazo</label>
          {deadline ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DateField value={deadline} onChange={setDeadline} />
              <button type="button" className={styles.btnSecondary} onClick={() => setDeadline(null)}><i className="ti ti-x" aria-hidden="true" /> Remover</button>
            </div>
          ) : (
            <button type="button" className={styles.btnSecondary} onClick={() => setDeadline(today)}><i className="ti ti-flag" aria-hidden="true" /> Definir prazo</button>
          )}
        </div>
        <div className={styles.formGroup} style={{ marginTop: '12px', flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <label className={styles.taskEditCheck}>
            <input type="checkbox" checked={focus} onChange={e => setFocus(e.target.checked)} /> Foco de hoje
          </label>
          <label className={styles.taskEditCheck}>
            <input type="checkbox" checked={blocking} onChange={e => setBlocking(e.target.checked)} /> Bloqueante
          </label>
        </div>
        <div className={styles.manualFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>Salvar</button>
        </div>
      </form>
    </div>,
    document.body
  )
}

// ─── Collapsible section shell (reuso para os dois gerenciadores) ─────────────
function ManagerSection({ icon, title, count, open, onToggle, children }) {
  return (
    <div className={styles.taskSection}>
      <button className={`${styles.taskSectionHeader} ${open ? styles.taskSectionOpen : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className={styles.taskSectionTitle}><i className={`ti ${icon}`} aria-hidden="true" />{title}</span>
        <span className={styles.taskCountBadge}>{count}</span>
        <i className={`ti ti-chevron-down ${styles.chevron}`} aria-hidden="true" />
      </button>
      {open && <div className={styles.taskBody}>{children}</div>}
    </div>
  )
}

// ─── Projects manager ─────────────────────────────────────────────────────────
export function ProjectsManager({ projects, open, onToggle, onAdd, onRename, onRecolor, onDelete, onToggleHidden }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#5B8DEF')
  const add = () => { const n = newName.trim(); if (!n) return; onAdd(n, newColor); setNewName('') }
  return (
    <ManagerSection icon="ti-folders" title="Projetos" count={projects.length} open={open} onToggle={onToggle}>
      <div className={styles.projList}>
        {projects.map(p => {
          const isGeral = p.id === GERAL_ID
          return (
            <div key={p.id} className={styles.projRow}>
              <ColorSwatch color={p.color} onChange={c => onRecolor(p.id, c)} small />
              <input className={styles.projNameInput} value={p.name} onChange={e => onRename(p.id, e.target.value)} disabled={isGeral} aria-label="Nome do projeto" />
              {!isGeral && (
                <button className={styles.iconAction} onClick={() => onToggleHidden(p.id)} aria-label={p.hidden ? 'Mostrar projeto' : 'Ocultar projeto'} title={p.hidden ? 'Mostrar na visão' : 'Ocultar da visão'}>
                  <i className={`ti ${p.hidden ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              )}
              <button className={`${styles.iconAction} ${styles.iconActionDanger}`} onClick={() => onDelete(p.id)} aria-label="Remover projeto" disabled={isGeral} title={isGeral ? 'Geral não pode ser removido' : 'Remover'}>
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
      <div className={styles.projAddRow}>
        <ColorSwatch color={newColor} onChange={setNewColor} small />
        <input className={styles.taskAddInput} placeholder="Novo projeto..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} aria-label="Novo projeto" />
        <button type="button" className={styles.taskAddBtn} onClick={add} disabled={!newName.trim()} aria-label="Adicionar projeto">
          <i className="ti ti-plus" aria-hidden="true" />
        </button>
      </div>
    </ManagerSection>
  )
}

// ─── Categories manager ───────────────────────────────────────────────────────
export function CategoriesManager({ categories, open, onToggle, onAdd, onRename, onRecolor, onDelete }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6D5DF5')
  const add = () => { const n = newName.trim(); if (!n) return; onAdd(n, newColor); setNewName('') }
  return (
    <ManagerSection icon="ti-tags" title="Categorias" count={categories.length} open={open} onToggle={onToggle}>
      <div className={styles.projList}>
        {categories.map(c => (
          <div key={c.id} className={styles.projRow}>
            <ColorSwatch color={c.color} onChange={col => onRecolor(c.id, col)} small />
            <input className={styles.projNameInput} value={c.name} onChange={e => onRename(c.id, e.target.value)} aria-label="Nome da categoria" />
            <button className={`${styles.iconAction} ${styles.iconActionDanger}`} onClick={() => onDelete(c.id)} aria-label="Remover categoria" disabled={categories.length <= 1}>
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className={styles.projAddRow}>
        <ColorSwatch color={newColor} onChange={setNewColor} small />
        <input className={styles.taskAddInput} placeholder="Nova categoria..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} aria-label="Nova categoria" />
        <button type="button" className={styles.taskAddBtn} onClick={add} disabled={!newName.trim()} aria-label="Adicionar categoria">
          <i className="ti ti-plus" aria-hidden="true" />
        </button>
      </div>
    </ManagerSection>
  )
}
