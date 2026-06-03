import styles from '../App.module.css'
import { fmtDur } from '../lib/format'
import { parseProjectId, parseCategoryId } from '../lib/storage'
import { TimeField } from './pickers'

// barra de captura persistente — o tempo é o herói; projeto + categoria já vêm dos últimos usados
export function TimerBar({
  active, elapsed, desc, projectId, categoryId, projects, categories, startStr,
  onDescChange, onProjectChange, onCategoryChange, onStart, onStop, onStartTimeChange,
}) {
  return (
    <section className={`${styles.timerBand} ${active ? styles.timerBandActive : ''}`}>
      <div className={styles.timerBandFields}>
        <input
          className={styles.timerInput}
          placeholder="O que você está trabalhando?"
          value={desc}
          onChange={e => onDescChange(e.target.value)}
        />
        <div className={styles.selectWrap}>
          <select className={styles.projSelect} value={projectId} onChange={e => onProjectChange(parseProjectId(e.target.value))} aria-label="Projeto">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
        </div>
        <div className={styles.selectWrap}>
          <select className={styles.projSelect} value={categoryId ?? ''} onChange={e => onCategoryChange(parseCategoryId(e.target.value))} aria-label="Categoria">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="">Sem categoria</option>
          </select>
          <i className={`ti ti-chevron-down ${styles.selectIcon}`} aria-hidden="true" />
        </div>
      </div>

      {active && (
        <div className={styles.timerStartEdit}>
          <span className={styles.timerStartLabel}><i className="ti ti-clock-edit" aria-hidden="true" />Início</span>
          <TimeField value={startStr} onChange={onStartTimeChange} />
        </div>
      )}

      <div className={styles.timerReadout}>
        {active && <span className={styles.pulseDot} aria-hidden="true" />}
        <span className={`${styles.timerDisplay} ${active ? styles.timerActive : ''}`}>{fmtDur(elapsed)}</span>
      </div>

      <div className={styles.timerBtnWrap}>
        <button
          className={`${styles.btnPrimary} ${styles.btnTimer} ${active ? styles.btnStop : ''}`}
          onClick={active ? onStop : onStart}
          title={active ? 'Parar (Space)' : 'Iniciar (Space)'}
        >
          <i className={`ti ${active ? 'ti-player-stop' : 'ti-player-play'}`} aria-hidden="true" />
          {active ? 'Parar' : 'Iniciar'}
        </button>
        <span className={styles.kbdHint}><kbd>Space</kbd></span>
      </div>
    </section>
  )
}
