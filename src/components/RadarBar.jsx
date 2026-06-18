import styles from '../App.module.css'
import { FALLBACK_COLOR } from '../lib/storage'
import { businessDaysSince } from '../lib/selectors'

function deadlineText(deadline, today) {
  if (deadline === today) return 'vence hoje'
  const d = new Date(deadline + 'T12:00:00')
  return `venceu ${d.getDate()}/${d.getMonth() + 1}`
}

function RadarItem({ task, project, signal, actions, active }) {
  return (
    <div className={`${styles.radarItem} ${active ? styles.radarItemActive : ''}`} style={{ '--accent': project?.color || FALLBACK_COLOR }}>
      <span className={styles.radarDot} aria-hidden="true" />
      <span className={styles.radarText}>
        <span className={styles.radarTitle}>{task.title}</span>
        <span className={styles.radarMeta}>
          <span className={styles.radarProj}>{project?.name || 'Geral'}</span>
          {signal && <span className={styles.radarSignal}>{signal}</span>}
        </span>
      </span>
      <span className={styles.radarActions}>{actions}</span>
    </div>
  )
}

// radar transversal — ignora projeto, agrupa por tipo de urgência; só leitura + ação rápida
export function RadarBar({ radar, projById, today, onComplete, onBringBack, onStartTimer, onStop, onRemoveFocus, timerActive, timerTaskId }) {
  if (radar.isEmpty) {
    return (
      <section className={`${styles.radar} ${styles.radarCalm}`} aria-label="Radar">
        <i className="ti ti-mug" aria-hidden="true" />
        <span>Nada pegando fogo — radar limpo.</span>
      </section>
    )
  }

  const completeBtn = t => (
    <button className={styles.radarAction} onClick={() => onComplete(t)} aria-label="Concluir" title="Concluir">
      <i className="ti ti-check" aria-hidden="true" />
    </button>
  )
  const startBtn = t => (timerActive && timerTaskId === t.id) ? (
    <button className={styles.radarAction} onClick={() => onStop()} aria-label="Parar timer" title="Parar timer (não conclui a tarefa)">
      <i className="ti ti-player-stop" aria-hidden="true" />
    </button>
  ) : (
    <button className={styles.radarAction} onClick={() => onStartTimer(t)} disabled={timerActive} aria-label="Iniciar timer" title={timerActive ? 'Timer em andamento' : 'Iniciar timer'}>
      <i className="ti ti-player-play" aria-hidden="true" />
    </button>
  )

  return (
    <section className={styles.radar} aria-label="Radar">
      {radar.atrasadas.length > 0 && (
        <div className={`${styles.radarGroup} ${styles.radarGroupDanger}`}>
          <div className={styles.radarGroupLabel}><i className="ti ti-alarm" aria-hidden="true" />Atrasadas<span className={styles.radarCount}>{radar.atrasadas.length}</span></div>
          <div className={styles.radarList}>
            {radar.atrasadas.map(t => (
              <RadarItem key={t.id} task={t} project={projById(t.projectId)} signal={deadlineText(t.deadline, today)} actions={<>{startBtn(t)}{completeBtn(t)}</>} />
            ))}
          </div>
        </div>
      )}

      {radar.aguardando.length > 0 && (
        <div className={`${styles.radarGroup} ${styles.radarGroupWarn}`}>
          <div className={styles.radarGroupLabel}><i className="ti ti-hourglass-high" aria-hidden="true" />Aguardando parado<span className={styles.radarCount}>{radar.aguardando.length}</span></div>
          <div className={styles.radarList}>
            {radar.aguardando.map(t => (
              <RadarItem
                key={t.id}
                task={t}
                project={projById(t.projectId)}
                signal={`${t.waitingPerson ? t.waitingPerson + ' · ' : ''}há ${businessDaysSince(t.waitingSince)}d úteis`}
                actions={
                  <>
                    <button className={styles.radarAction} onClick={() => onBringBack(t)} aria-label="Trazer de volta" title="Trazer de volta p/ aberta">
                      <i className="ti ti-arrow-back-up" aria-hidden="true" />
                    </button>
                    {completeBtn(t)}
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}

      {radar.foco.length > 0 && (
        <div className={`${styles.radarGroup} ${styles.radarGroupFocus}`}>
          <div className={styles.radarGroupLabel}><i className="ti ti-star" aria-hidden="true" />Foco do dia<span className={styles.radarCount}>{radar.foco.length}</span></div>
          <div className={styles.radarList}>
            {radar.foco.map(t => (
              <RadarItem key={t.id} task={t} project={projById(t.projectId)} active={timerActive && timerTaskId === t.id} signal={t.status === 'aguardando' ? 'cobrar hoje' : null}
                actions={<>{startBtn(t)}{completeBtn(t)}
                  <button className={styles.radarAction} onClick={() => onRemoveFocus(t)} aria-label="Remover do foco do dia" title="Remover do foco do dia">
                    <i className="ti ti-star-off" aria-hidden="true" />
                  </button>
                </>} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
