import styles from '../App.module.css'
import { fmtHoursDec, fmtDayShort, localDateStr, addDays } from '../lib/format'
import { FALLBACK_COLOR } from '../lib/storage'
import { groupByProject, businessDaysSince } from '../lib/selectors'

function ProjGroup({ project, children }) {
  return (
    <div className={styles.colaProjGroup} style={{ '--accent': project.color || FALLBACK_COLOR }}>
      <div className={styles.colaProjLabel}><span className={styles.colaProjDot} aria-hidden="true" />{project.name}</div>
      <ul className={styles.colaList}>{children}</ul>
    </div>
  )
}

// cola do daily — três blocos derivados (fiz / vou fazer / aguardando), agrupados por projeto
export function ColaDaily({ cola, projects, today, timerActive, onStartTimer, onComplete }) {
  const { lastDay, fizEntries, fizDone, vouFazer, bloqueios } = cola
  const lastDayTotal = fizEntries.reduce((s, e) => s + e.dur, 0)
  const lastDayLabel = lastDay === localDateStr(addDays(new Date(), -1)) ? 'Ontem' : fmtDayShort(lastDay)

  const entriesByProj = groupByProject(fizEntries, projects)
  const doneByProj = groupByProject(fizDone, projects)
  const vouByProj = groupByProject(vouFazer, projects)
  const bloqByProj = groupByProject(bloqueios, projects)

  return (
    <section className={styles.colaCard}>
      <header className={styles.colaHead}>
        <span className={styles.colaTitle}><i className="ti ti-clipboard-text" aria-hidden="true" />Cola da daily</span>
      </header>

      {/* Fiz — último dia com registro */}
      <div className={styles.colaBlock}>
        <div className={styles.colaBlockHead}>
          <span className={styles.colaBlockLabel}><i className="ti ti-arrow-back-up" aria-hidden="true" />{lastDayLabel} · fiz</span>
          {lastDayTotal > 0 && <span className={styles.colaBlockMeta}>{fmtHoursDec(lastDayTotal)}</span>}
        </div>
        {fizEntries.length === 0 && fizDone.length === 0 ? (
          <p className={styles.colaEmpty}>Nada registrado ainda.</p>
        ) : (
          <>
            {entriesByProj.map(g => (
              <ProjGroup key={`e${g.project.id}`} project={g.project}>
                {g.items.map(e => (
                  <li key={e.id} className={styles.colaItem}>
                    <span className={styles.colaItemText}>{e.desc}</span>
                    <span className={styles.colaItemMeta}>{fmtHoursDec(e.dur)}</span>
                  </li>
                ))}
              </ProjGroup>
            ))}
            {doneByProj.map(g => (
              <ProjGroup key={`d${g.project.id}`} project={g.project}>
                {g.items.map(t => (
                  <li key={t.id} className={`${styles.colaItem} ${styles.colaItemDone}`}>
                    <span className={styles.colaCheck} aria-hidden="true"><i className="ti ti-check" /></span>
                    <span className={styles.colaItemText}>{t.title}</span>
                  </li>
                ))}
              </ProjGroup>
            ))}
          </>
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
                </li>
              ))}
            </ProjGroup>
          ))
        )}
      </div>
    </section>
  )
}
