import styles from '../App.module.css'
import { fmtClock, localDateStr, addDays } from '../lib/format'
import { FALLBACK_COLOR } from '../lib/storage'
import { groupByProject, businessDaysSince } from '../lib/selectors'
import { DateField } from './pickers'

const shiftDay = (day, n) => localDateStr(addDays(new Date(day + 'T12:00:00'), n))

// corte do dia às 12:00 — manhã < 12h, tarde >= 12h
const PERIODS = [
  { key: 'manha', label: 'Manhã', icon: 'ti-sun' },
  { key: 'tarde', label: 'Tarde', icon: 'ti-sunset-2' },
]
const periodOfHour = h => (h < 12 ? 'manha' : 'tarde')
const donePeriod = t => periodOfHour(new Date(t.completedAt).getHours())
const loosePeriod = e => periodOfHour(parseInt(e.start, 10) || 0)

function ProjGroup({ project, children }) {
  return (
    <div className={styles.colaProjGroup} style={{ '--accent': project.color || FALLBACK_COLOR }}>
      <div className={styles.colaProjLabel}><span className={styles.colaProjDot} aria-hidden="true" />{project.name}</div>
      <ul className={styles.colaList}>{children}</ul>
    </div>
  )
}

// cola do daily — três blocos derivados (fiz / vou fazer / aguardando), agrupados por projeto
export function ColaDaily({ cola, projects, today, timerActive, selectedDay, onSelectDay, onEditItem, onStartTimer, onComplete }) {
  const { lastDay, fizEntries, fizLoose, fizDone, vouFazer, bloqueios } = cola
  const lastDayTotal = fizEntries.reduce((s, e) => s + e.dur, 0)
  const canNext = lastDay < today

  // bloco "fiz" dividido em manhã/tarde, e dentro de cada período agrupado por projeto
  const fizByPeriod = PERIODS.map(per => {
    const groups = projects
      .map(p => ({
        project: p,
        done: fizDone.filter(t => t.projectId === p.id && donePeriod(t) === per.key),
        loose: fizLoose.filter(e => e.projectId === p.id && loosePeriod(e) === per.key),
      }))
      .filter(g => g.done.length > 0 || g.loose.length > 0)
    const total = groups.reduce(
      (s, g) => s + g.done.reduce((a, t) => a + t.secs, 0) + g.loose.reduce((a, e) => a + e.dur, 0),
      0,
    )
    return { ...per, groups, total }
  }).filter(per => per.groups.length > 0)
  const vouByProj = groupByProject(vouFazer, projects)
  const bloqByProj = groupByProject(bloqueios, projects)

  const editBtn = (kind, obj) => (
    <button type="button" className={styles.iconAction} onClick={() => onEditItem(kind, obj)} aria-label="Editar" title="Editar nome e data">
      <i className="ti ti-pencil" aria-hidden="true" />
    </button>
  )

  return (
    <section className={styles.colaCard}>
      <header className={styles.colaHead}>
        <span className={styles.colaTitle}><i className="ti ti-clipboard-text" aria-hidden="true" />Cola da daily</span>
      </header>

      {/* Fiz — dia selecionável (default: último dia com registro) */}
      <div className={styles.colaBlock}>
        <div className={styles.colaBlockHead}>
          <span className={styles.colaBlockLabel}><i className="ti ti-arrow-back-up" aria-hidden="true" />fiz</span>
          <div className={styles.colaDayNav}>
            <button type="button" className={styles.colaDayArrow} onClick={() => onSelectDay(shiftDay(lastDay, -1))} aria-label="Dia anterior" title="Dia anterior">
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
            <DateField value={lastDay} onChange={d => onSelectDay(d > today ? null : d)} />
            <button type="button" className={styles.colaDayArrow} onClick={() => onSelectDay(shiftDay(lastDay, 1))} disabled={!canNext} aria-label="Próximo dia" title="Próximo dia">
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
            {selectedDay && (
              <button type="button" className={styles.colaDayReset} onClick={() => onSelectDay(null)} aria-label="Voltar ao último dia" title="Voltar ao último dia">
                <i className="ti ti-restore" aria-hidden="true" />
              </button>
            )}
          </div>
          {lastDayTotal > 0 && <span className={styles.colaBlockMeta}>{fmtClock(lastDayTotal)}</span>}
        </div>
        {fizByPeriod.length === 0 ? (
          <p className={styles.colaEmpty}>Nada registrado ainda.</p>
        ) : (
          fizByPeriod.map(per => (
            <div key={per.key} className={styles.colaPeriod}>
              <div className={styles.colaPeriodHead}>
                <span className={styles.colaPeriodLabel}><i className={`ti ${per.icon}`} aria-hidden="true" />{per.label}</span>
                {per.total > 0 && <span className={styles.colaPeriodMeta}>{fmtClock(per.total)}</span>}
              </div>
              {per.groups.map(g => (
                <ProjGroup key={`f${per.key}${g.project.id}`} project={g.project}>
                  {g.done.map(t => (
                    <li key={`d${t.id}`} className={`${styles.colaItem} ${styles.colaItemDone}`}>
                      <span className={styles.colaCheck} aria-hidden="true"><i className="ti ti-check" /></span>
                      <span className={styles.colaItemText}>{t.title}</span>
                      {t.secs > 0 && <span className={styles.colaItemMeta}>{fmtClock(t.secs)}</span>}
                      <div className={styles.colaActions}>{editBtn('task', t)}</div>
                    </li>
                  ))}
                  {g.loose.map(e => (
                    <li key={`e${e.id}`} className={styles.colaItem}>
                      <span className={styles.colaItemText}>{e.desc}</span>
                      <span className={styles.colaItemMeta}>{fmtClock(e.dur)}</span>
                      <div className={styles.colaActions}>{editBtn('entry', e)}</div>
                    </li>
                  ))}
                </ProjGroup>
              ))}
            </div>
          ))
        )}
      </div>

      <div className={styles.colaDivider} aria-hidden="true" />

      {/* Vou fazer — foco do dia */}
      <div className={styles.colaBlock}>
        <div className={styles.colaBlockHead}>
          <span className={styles.colaBlockLabel}><i className="ti ti-arrow-forward-up" aria-hidden="true" />Hoje · vou fazer</span>
          {vouFazer.length > 0 && <span className={styles.colaBlockMeta}>{vouFazer.length}</span>}
        </div>
        {vouFazer.length === 0 ? (
          <p className={styles.colaEmpty}>Marque tarefas com <i className="ti ti-star" aria-hidden="true" /> pra montar o dia.</p>
        ) : (
          vouByProj.map(g => (
            <ProjGroup key={`v${g.project.id}`} project={g.project}>
              {g.items.map(t => (
                <li key={t.id} className={styles.colaItem}>
                  <span className={styles.colaItemText}>{t.title}</span>
                  <div className={styles.colaActions}>
                    {editBtn('task', t)}
                    <button className={styles.iconAction} onClick={() => onStartTimer(t)} disabled={timerActive} aria-label="Iniciar timer" title={timerActive ? 'Timer em andamento' : 'Iniciar timer'}>
                      <i className="ti ti-player-play" aria-hidden="true" />
                    </button>
                    <button className={styles.iconAction} onClick={() => onComplete(t.id)} aria-label="Concluir" title="Concluir">
                      <i className="ti ti-check" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ProjGroup>
          ))
        )}
      </div>

      <div className={styles.colaDivider} aria-hidden="true" />

      {/* Bloqueios — aguardando + tarefas marcadas bloqueante */}
      <div className={styles.colaBlock}>
        <div className={styles.colaBlockHead}>
          <span className={styles.colaBlockLabel}><i className="ti ti-hourglass-high" aria-hidden="true" />Bloqueios</span>
          {bloqueios.length > 0 && <span className={styles.colaBlockMeta}>{bloqueios.length}</span>}
        </div>
        {bloqueios.length === 0 ? (
          <p className={styles.colaEmpty}>Nada bloqueado.</p>
        ) : (
          bloqByProj.map(g => (
            <ProjGroup key={`a${g.project.id}`} project={g.project}>
              {g.items.map(t => (
                <li key={t.id} className={styles.colaItem}>
                  <span className={styles.colaItemText}>{t.title}</span>
                  {t.status === 'aguardando' ? (
                    <span className={styles.colaItemMeta}>{t.waitingPerson ? `${t.waitingPerson} · ` : ''}{businessDaysSince(t.waitingSince)}d</span>
                  ) : (
                    <span className={styles.colaBlockTag}><i className="ti ti-alert-octagon" aria-hidden="true" />bloqueante</span>
                  )}
                  <div className={styles.colaActions}>{editBtn('task', t)}</div>
                </li>
              ))}
            </ProjGroup>
          ))
        )}
      </div>
    </section>
  )
}
