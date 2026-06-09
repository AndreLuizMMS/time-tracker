import { useState, useMemo } from 'react'
import styles from '../App.module.css'
import { fmtClock, fmtDate, localDateStr } from '../lib/format'
import { FALLBACK_COLOR } from '../lib/storage'
import { taskSignals } from '../lib/selectors'
import { PriorityPicker, StatusControl, WaitingControl, DeadlineControl, ChipPicker, TimeLogControl } from './pickers'

// selo de tempo consumido (mono); soma o cronômetro vivo quando a tarefa está rodando
function TimeBadge({ secs, running }) {
  if (secs <= 0) return null
  return (
    <span className={`${styles.taskTimeBadge} ${running ? styles.taskTimeBadgeRunning : ''}`} title={running ? 'Tempo consumido (rodando)' : 'Tempo consumido'}>
      <i className="ti ti-clock-hour-4" aria-hidden="true" />{fmtClock(secs)}
    </span>
  )
}

// ─── Task row (coração denso) ─────────────────────────────────────────────────
function TaskRow({ task, categories, projects, today, timerActive, secsByTask, timerTaskId, timerElapsed, a, onPriorityOpenChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const sig = taskSignals(task, today)
  const isFocus = task.todayDate === today
  const running = timerActive && timerTaskId === task.id
  const spent = (secsByTask?.get(task.id) || 0) + (running ? timerElapsed : 0)
  const prioColor = { 1: '#E24B4A', 2: '#E0A03B', 3: '#1D9E75', 4: '#74726B' }[task.priority]

  const commit = () => { const t = draft.trim(); if (t) a.commitTitle(task.id, t); setEditing(false) }

  return (
    <div className={`${styles.taskRow} ${task.status === 'concluida' ? styles.taskRowDone : ''} ${task.blocking ? styles.taskRowBlocking : ''}`} style={{ '--task-priority-color': prioColor }}>
      <div className={styles.taskTop}>
        <PriorityPicker value={task.priority} onChange={p => a.setPriority(task.id, p)} onOpenChange={onPriorityOpenChange} />
        {editing ? (
          <input
            className={styles.taskEditInput}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') { setDraft(task.title); setEditing(false) } }}
            autoFocus
            aria-label="Editar tarefa"
          />
        ) : (
          <span className={styles.taskTitle} onDoubleClick={() => { setDraft(task.title); setEditing(true) }} title="Duplo clique para editar">{task.title}</span>
        )}
        <div className={styles.taskActions}>
          <button className={`${styles.iconAction} ${isFocus ? styles.iconActionStar : ''}`} onClick={() => a.toggleFocus(task.id)} aria-pressed={isFocus} aria-label={isFocus ? 'Remover do foco' : 'Foco de hoje'} title={isFocus ? 'No foco de hoje' : 'Marcar pra hoje'}>
            <i className="ti ti-star" aria-hidden="true" />
          </button>
          <button className={`${styles.iconAction} ${task.blocking ? styles.iconActionBlocking : ''}`} onClick={() => a.toggleBlocking(task.id)} aria-pressed={task.blocking} aria-label={task.blocking ? 'Remover bloqueante' : 'Marcar bloqueante'} title={task.blocking ? 'Bloqueante' : 'Marcar como bloqueante'}>
            <i className="ti ti-alert-octagon" aria-hidden="true" />
          </button>
          {task.status !== 'concluida' && (
            <button className={styles.iconAction} onClick={() => a.startTimer(task)} disabled={timerActive} aria-label="Iniciar timer" title={timerActive ? 'Timer em andamento' : 'Iniciar timer'}>
              <i className="ti ti-player-play" aria-hidden="true" />
            </button>
          )}
          {task.status !== 'concluida' && (
            <TimeLogControl onLog={(secs, conclude) => a.logTime(task, secs, conclude)} />
          )}
          <button className={styles.iconAction} onClick={() => a.edit(task)} aria-label="Editar tarefa" title="Editar todos os campos">
            <i className="ti ti-pencil" aria-hidden="true" />
          </button>
          <button className={`${styles.iconAction} ${styles.iconActionDanger}`} onClick={() => a.remove(task.id)} aria-label="Remover tarefa">
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.taskMeta}>
        {task.blocking && (
          <span className={styles.taskBlockingBadge} title="Bloqueante"><i className="ti ti-alert-octagon" aria-hidden="true" />Bloqueante</span>
        )}
        <StatusControl
          status={task.status}
          onToAberta={() => a.toAberta(task.id)}
          onToAguardando={() => a.toAguardando(task.id)}
          onToConcluida={() => a.toConcluida(task.id)}
          onReopen={() => a.reopen(task.id)}
        />
        {task.status === 'aguardando' && (
          <WaitingControl person={task.waitingPerson} businessDays={sig.businessDays} stuck={sig.waitingStuck} onChangePerson={p => a.setWaitingPerson(task.id, p)} />
        )}
        <ChipPicker value={task.categoryId} options={categories} onChange={c => a.setCategory(task.id, c)} allowNone noneLabel="Sem categoria" icon="ti-tag" title="Categoria" />
        <ChipPicker value={task.projectId} options={projects} onChange={p => a.setProject(task.id, p)} title="Projeto" icon="ti-folder" />
        <DeadlineControl deadline={task.deadline} state={sig.deadlineState} onChange={d => a.setDeadline(task.id, d)} />
        <TimeBadge secs={spent} running={running} />
      </div>
    </div>
  )
}

// ─── Linha de tarefa concluída (hoje / passadas) ──────────────────────────────
function DoneRow({ task, secs, showDate, onReopen }) {
  return (
    <div className={`${styles.taskRow} ${styles.taskRowDone}`} style={{ '--task-priority-color': 'var(--success)' }}>
      <div className={styles.taskTop}>
        <span className={styles.doneCheckMini} aria-hidden="true"><i className="ti ti-check" /></span>
        <span className={`${styles.taskTitle} ${styles.taskTitleDone}`}>{task.title}</span>
        {showDate && task.completedAt && <span className={styles.doneDate}>{fmtDate(localDateStr(new Date(task.completedAt)))}</span>}
        <TimeBadge secs={secs} />
        <div className={styles.taskActions}>
          <button className={styles.iconAction} onClick={() => onReopen(task.id)} aria-label="Reabrir" title="Reabrir">
            <i className="ti ti-rotate" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Project column ───────────────────────────────────────────────────────────
export function ProjectColumn({ vm, categories, projects, today, timerActive, secsByTask, timerTaskId, timerElapsed, actions, periodLabel, onToggleCollapse, onQuickAdd }) {
  const { project, abertas, aguardando, concluidasHoje, concluidasPassadas = [], periodSecs, openCount } = vm
  const collapsed = !!project.collapsed
  const [frozenIds, setFrozenIds] = useState(null)
  const [adding, setAdding] = useState('')

  // anti-teleporte: congela a ordem das abertas enquanto um picker de prioridade está aberto
  const displayAbertas = useMemo(() => {
    if (!frozenIds) return abertas
    const map = new Map(abertas.map(t => [t.id, t]))
    const inOrder = frozenIds.map(id => map.get(id)).filter(Boolean)
    const extra = abertas.filter(t => !frozenIds.includes(t.id))
    return [...inOrder, ...extra]
  }, [abertas, frozenIds])
  const handlePrioOpen = open => setFrozenIds(open ? abertas.map(t => t.id) : null)

  const submitAdd = () => { const t = adding.trim(); if (!t) return; onQuickAdd(project.id, t); setAdding('') }

  const rowProps = { categories, projects, today, timerActive, secsByTask, timerTaskId, timerElapsed, a: actions, onPriorityOpenChange: handlePrioOpen }
  const secsOf = id => secsByTask?.get(id) || 0

  return (
    <section className={`${styles.projectCard} ${collapsed ? styles.projectCardCollapsed : ''}`} style={{ '--accent': project.color || FALLBACK_COLOR }}>
      <button
        type="button"
        className={styles.projectHead}
        onClick={() => onToggleCollapse(project.id)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expandir ${project.name}` : `Recolher ${project.name}`}
        title={collapsed ? 'Expandir' : 'Recolher'}
      >
        <i className={`ti ti-chevron-down ${styles.projectChevron} ${collapsed ? styles.projectChevronClosed : ''}`} aria-hidden="true" />
        <span className={styles.projectDot} aria-hidden="true" />
        <span className={styles.projectName}>{project.name}</span>
        <span className={styles.projectOpenCount} title="Tarefas abertas">{openCount}</span>
        <span className={styles.projectPeriod} title={`Tempo ${periodLabel}`}>{fmtClock(periodSecs)}</span>
      </button>

      {!collapsed && (
        <div className={styles.projectBody}>
          <div className={styles.projectQuickAdd}>
            <input
              className={styles.taskAddInput}
              placeholder="Adicionar tarefa..."
              value={adding}
              onChange={e => setAdding(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAdd() } }}
              aria-label={`Nova tarefa em ${project.name}`}
            />
            <button type="button" className={styles.taskAddBtn} onClick={submitAdd} disabled={!adding.trim()} aria-label="Adicionar tarefa">
              <i className="ti ti-plus" aria-hidden="true" />
            </button>
          </div>

          {displayAbertas.length > 0 && (
            <div className={styles.projectSection}>
              <div className={styles.projectSectionLabel}>Abertas</div>
              <div className={styles.taskList}>
                {displayAbertas.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
              </div>
            </div>
          )}

          {aguardando.length > 0 && (
            <div className={styles.projectSection}>
              <div className={styles.projectSectionLabel}>Aguardando<span className={styles.projectSectionCount}>{aguardando.length}</span></div>
              <div className={styles.taskList}>
                {aguardando.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
              </div>
            </div>
          )}

          {concluidasHoje.length > 0 && (
            <div className={styles.projectSection}>
              <div className={styles.projectSectionLabel}>Concluídas hoje<span className={styles.projectSectionCount}>{concluidasHoje.length}</span></div>
              <div className={styles.taskList}>
                {concluidasHoje.map(t => (
                  <DoneRow key={t.id} task={t} secs={secsOf(t.id)} onReopen={actions.reopen} />
                ))}
              </div>
            </div>
          )}

          {concluidasPassadas.length > 0 && (
            <div className={styles.projectSection}>
              <div className={styles.projectSectionLabel}>Passadas<span className={styles.projectSectionCount}>{concluidasPassadas.length}</span></div>
              <div className={styles.taskList}>
                {concluidasPassadas.map(t => (
                  <DoneRow key={t.id} task={t} secs={secsOf(t.id)} showDate onReopen={actions.reopen} />
                ))}
              </div>
            </div>
          )}

          {abertas.length === 0 && aguardando.length === 0 && concluidasHoje.length === 0 && concluidasPassadas.length === 0 && (
            <p className={styles.projectEmpty}>Sem tarefas abertas.</p>
          )}
        </div>
      )}
    </section>
  )
}
